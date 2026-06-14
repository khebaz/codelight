const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window
  closeWindow: () => ipcRenderer.send('win:close'),
  minimizeWindow: () => ipcRenderer.send('win:minimize'),
  maximizeWindow: () => ipcRenderer.send('win:maximize'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),

  // Web search
  webSearch: query => ipcRenderer.invoke('search:web', query),

  // Directory listing
  listDir: dirPath => ipcRenderer.invoke('fs:listDir', dirPath),

  // Platform
  platform: () => ipcRenderer.invoke('platform'),

  // Shell
  execCommand: cmd => ipcRenderer.invoke('exec:cmd', cmd),

  // Store (persistent JSON file)
  storeGet: key => ipcRenderer.invoke('store:get', key),
  storeSet: (key, val) => ipcRenderer.invoke('store:set', key, val),

  // File dialogs
  showSaveDialog: filters => ipcRenderer.invoke('dlg:saveFile', filters),
  showOpenDialog: () => ipcRenderer.invoke('dlg:openJson'),
  writeFile: (fp, content) => ipcRenderer.invoke('dlg:writeFile', fp, content),
  readFile: fp => ipcRenderer.invoke('dlg:readFile', fp),

  // Clipboard
  copy: text => ipcRenderer.invoke('clip:write', text),

  // Flag
  isElectron: true,

  // .env file keys
  getEnvKeys: () => ipcRenderer.invoke('env:getKeys'),
});
