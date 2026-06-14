# Code Light

> Desktop AI coding assistant built with Electron.
> Multi-provider AI support, automatic failover, tool calling, file management, shell execution, conversation persistence, and local workspace automation.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-35+-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## Features

| Feature                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| Multi-Provider         | OpenRouter, OpenAI, Anthropic, Gemini, Groq, Custom, and more |
| Auto Rotation          | Silent fallback across models, keys, and providers on failure  |
| Tool Calling           | File read/write, shell execution, web search, custom tools     |
| Multi-Key Rotation     | Up to 10 API keys per provider, auto-rotated on rate limits    |
| Free Model Priority    | Free tier models tried first before paid                       |
| Live Model Discovery   | Fetches live models from provider API as last-resort fallback  |
| Conversation History   | Persistent local chat storage with search (Ctrl+F)            |
| Dark Mode              | Toggle in settings                                            |
| File Explorer          | Built-in file browser pane                                    |
| Error Recovery         | Context-length overflow, credit-limit retry, fallback model   |
| Templates              | Python, React, Docker, and more quick-start templates         |

---

## Requirements

- Windows 10 or 11
- Node.js 20+
- npm 10+
- Electron 35+ (included in devDependencies)

---

## Quick Start

```bash
# Install dependencies
npm install

# Launch the app
npm start

# Launch with DevTools
npm run start:dev
```

1. Click the **"No API Key"** badge at the top
2. Choose a provider (OpenRouter recommended for free access)
3. Paste your API key
4. Click **"Save & Load Models"**
5. Type a message and press Enter

---

## Providers

### OpenRouter (recommended)
Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys). Access 100+ models with one key. Free models use the `:free` suffix (e.g. `gpt-4o-mini:free`).

### OpenAI
Get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). Requires a paid account.

### Anthropic
Get a key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys). Claude models with API credits.

### Gemini (Google)
Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). No credit card required.

### Groq
Get a free key at [console.groq.com/keys](https://console.groq.com/keys). Ultra-fast inference with a free tier.

### OllamaFree (self-hosted, no key needed)
```bash
pip install ollamafreeapi
python server.py        # keep this terminal open
```
Distributed free Ollama network. No API key required. Models: deepseek-r1, mistral, llama3, gpt-oss, and more.

### FreeTheAI
Join [discord.gg/secrets](https://discord.gg/secrets), run `/signup`, get a free key. Supports tool calling.

### Custom Endpoint
Any OpenAI-compatible API. Enter your base URL and key manually.

---

## .env File

Place a `.env` file in the project root. Keys are auto-merged into the rotation:

```
OPENAI_KEY=sk-...
ANTHROPIC_KEY=sk-ant-...
OPENROUTER_KEY=sk-or-...
GEMINI_KEY=...
GROQ_KEY=gsk_...
```

See `.env.example` for the full template.

---

## Architecture

```
codelight.html   — Single-file application: UI + providers + chat logic + tool system + settings
main.js          — Electron main process: window, IPC handlers (search, files, shell, .env)
preload.js       — Context bridge: exposes electronAPI to the renderer
server.py        — Optional self-hosted OllamaFree proxy (Python FastAPI)
```

The app is designed as a single HTML file for portability. All state is persisted in localStorage and synced to an Electron store on disk.

### Provider Classes

| Class                | Description                                |
| -------------------- | ------------------------------------------ |
| `BaseProvider`       | Abstract: getModels(), chat(), streamChat() |
| `OpenAIProvider`     | OpenAI-compatible APIs (GPT, Gemini, Groq)  |
| `OpenRouterProvider` | OpenRouter API (extends OpenAIProvider)     |
| `AnthropicProvider`  | Anthropic Claude API                        |
| `OllamaFreeProvider` | Local OllamaFree proxy (no auth)            |

---

## Building for Distribution

```bash
# Windows installer (.exe)
npm run dist:win

# macOS (.dmg)
npm run dist:mac

# Linux (.AppImage / .deb)
npm run dist:linux
```

Output goes to the `dist/` directory.

---

## Security

Code Light can execute shell commands and modify files in your workspace based on AI-generated instructions.

- Always review AI-generated actions before running them
- The app runs with your user permissions
- Do not use untrusted API providers with sensitive codebases
- API keys are stored in your browser's localStorage and are never sent to any server except the selected API provider

---

## Known Issues

1. **Shell deadlock on Windows**: PowerShell may hang after executing commands. Press Ctrl+R to reload.
2. **Stale model after provider switch**: Click the model name in the header to pick the correct one.
3. **OpenRouter 404/403**: Many non-free OpenRouter models return errors. Use `:free` variants (e.g. `gpt-4o-mini:free`).
4. **OllamaFree server**: Must be running separately. If not started, rotation skips it silently.
5. **Electron store hydration**: Initial render uses localStorage defaults briefly before Electron store data loads.
6. **Rate limits**: Free API tiers have low limits. The rotation system handles retries but responses may be slow.

---

## Roadmap

- [ ] Multi-agent workflows
- [ ] Git integration (commit, diff, branch management)
- [ ] Workspace indexing and semantic search
- [ ] Plugin system for custom tools
- [ ] Voice commands
- [ ] macOS and Linux support (Electron packaging configured)

---

## Disclaimer

This software may execute shell commands and modify files based on AI model outputs.

Users are responsible for reviewing all actions before execution. The authors are not responsible for data loss, system damage, or API costs incurred through usage of this software.

---

## License

MIT
