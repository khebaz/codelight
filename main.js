const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 740,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#16162a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile('codelight.html');

  // Log console errors for debugging
  mainWindow.webContents.on('console-message', (e, level, msg) => {
    if (level >= 2) console.error('[renderer]', msg);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript("console.log('PAGE_LOADED')");
    // Capture page errors
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('error', e => { console.error('PAGE_ERROR:', e.message, e.filename, e.lineno); return true; });
      window.addEventListener('unhandledrejection', e => { console.error('PAGE_UNHANDLED:', e.reason); return true; });
    `);
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'bottom' });
  }
}

// ── Window Controls ──
ipcMain.on('win:close', () => mainWindow?.close());
ipcMain.on('win:minimize', () => mainWindow?.minimize());
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});

ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);

// ── Web Search (no API key needed) ──
ipcMain.handle('search:web', async (_e, query) => {
  try {
    const res = await fetch(`https://scouts-ai.com/api/search?q=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) return await res.json();
    // Fallback: DuckDuckGo
    const ddg = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    if (!ddg.ok) return { error: 'Search backends unavailable', results: [] };
    const data = await ddg.json();
    const results = [];
    if (data.AbstractText) results.push({ title: data.AbstractText?.slice(0,80), url: data.AbstractURL, content: data.AbstractText });
    if (data.Results?.length) data.Results.forEach(r => results.push({ title: r.Text?.split(' - ')[0]||'Result', url: r.FirstURL, content: r.Text }));
    if (data.RelatedTopics?.length) for (const t of data.RelatedTopics) {
      if (t.Topics) t.Topics.forEach(st => results.push({ title: st.Text?.split(' - ')[0]||'Result', url: st.FirstURL, content: st.Text }));
      else results.push({ title: t.Text?.split(' - ')[0]||'Result', url: t.FirstURL, content: t.Text });
    }
    return results.slice(0,10);
  } catch (err) { return { error: err.message, results: [] }; }
});

// ── Directory Listing ──
ipcMain.handle('fs:listDir', async (_e, dirPath) => {
  try {
    const target = dirPath ? path.resolve(dirPath) : __dirname;
    const entries = fs.readdirSync(target, { withFileTypes: true });
    const parent = path.resolve(target, '..');
    return {
      path: target,
      parent: parent === target ? null : parent,
      entries: entries.map(e => {
        let size = 0;
        if (e.isFile()) try { size = fs.statSync(path.join(target, e.name)).size; } catch {}
        return { name: e.name, isDir: e.isDirectory(), size };
      }),
    };
  } catch (err) { return { path: dirPath, parent: null, entries: [], error: err.message }; }
});

// ── Platform ──
ipcMain.handle('platform', () => process.platform);

// ── Shell Command ──
ipcMain.handle('exec:cmd', (_e, cmd) => {
  return new Promise(resolve => {
    exec(cmd, { timeout: 30000, cwd: require('os').homedir() }, (err, stdout, stderr) => {
      if (err) resolve(`⚠️ Exit code ${err.code}\n${stderr || err.message}`);
      else resolve(stdout || stderr || '(no output)');
    });
  });
});

// ── Persistent JSON Store (replaces localStorage) ──
const storePath = path.join(app.getPath('userData'), 'codelight-store.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  } catch { return {}; }
}

ipcMain.handle('store:get', (_e, key) => {
  const store = readStore();
  return key ? store[key] : store;
});

ipcMain.handle('store:set', (_e, key, value) => {
  const store = readStore();
  store[key] = value;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
});

// ── File Dialogs ──
ipcMain.handle('dlg:saveFile', async (_e, filters) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    filters: filters || [{ name: 'All', extensions: ['*'] }],
  });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('dlg:openJson', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dlg:writeFile', async (_e, fp, content) => {
  try { fs.writeFileSync(fp, content); return true; }
  catch { return false; }
});

ipcMain.handle('dlg:readFile', async (_e, fp) => {
  try { return fs.readFileSync(fp, 'utf-8'); }
  catch { return null; }
});

// ── Clipboard ──
ipcMain.handle('clip:write', (_e, text) => {
  require('electron').clipboard.writeText(text);
});

// ── .env file reader ──
ipcMain.handle('env:getKeys', () => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};
    const raw = fs.readFileSync(envPath, 'utf-8');
    const keys = {};
    const providerMap = {
      OPENAI_KEY: 'openai', ANTHROPIC_KEY: 'anthropic', OPENROUTER_KEY: 'openrouter',
      GEMINI_KEY: 'gemini', GROQ_KEY: 'groq',
    };
    const modelMap = {
      openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-4-6', openrouter: 'openrouter/auto',
      gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b',
    };
    for (const line of raw.split('\n')) {
      const m = line.trim().match(/^(\w+)=(.*)$/);
      if (!m) continue;
      const prov = providerMap[m[1]];
      if (prov) keys[prov] = { key: m[2], model: modelMap[prov] };
    }
    return keys;
  } catch { return {}; }
});

// ── App Events ──
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
