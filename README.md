# ExploUtor

VSCode extension for Roblox exploit development with Luau LSP integration, WebSocket executor connection, and automatic bundling.

## Features

### Core Modules
- **WebSocketManager** - Real-time connection to executor via WebSocket (default port: 9999)
- **BundlerIntegration** - Automatic code bundling with wax/darklua support
- **LuauLSP** - Full Language Server Protocol integration with exploit function signatures
- **ExecutionEngine** - Execute full files or selected code snippets
- **ExploitAPI** - Complete documentation for all exploit functions

### Key Features
1. **Execute Script (F5)** - Execute entire Luau file
2. **Execute Selection (Shift+F5)** - Execute selected code only
3. **Auto-bundling** - Automatically bundle with wax or darklua before execution
4. **IntelliSense** - Auto-completion for exploit functions
5. **Hover Documentation** - Detailed docs when hovering over functions
6. **Syntax Highlighting** - Luau syntax with exploit keyword support
7. **Status Bar** - Real-time connection status indicator

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the extension:
   ```bash
   npm run compile
   ```
4. Press F5 to open a new VSCode window with the extension loaded

### Optional Dependencies

For enhanced functionality, install these tools:

**Luau LSP** (Recommended):
```bash
# Install from https://github.com/JohnnyMorganz/luau-lsp
cargo install luau-lsp
```

**Darklua** (Optional bundler):
```bash
# Install from https://github.com/seaofvoices/darklua
cargo install darklua
```

**Wax** (Optional bundler):
```bash
# Install from https://github.com/latte-soft/wax
```

## Configuration

Settings available in VSCode (`Ctrl+,` → search "ExploUtor"):

```json
{
  "exploitor.executor.host": "localhost",
  "exploitor.executor.port": 9999,
  "exploitor.bundler.enabled": true,
  "exploitor.bundler.tool": "darklua", // or "wax"
  "exploitor.lsp.enabled": true
}
```

## WebSocket Protocol

The extension communicates with the executor using this JSON protocol:

### Message Types

**Execute Request:**
```json
{
  "type": "execute",
  "code": "print('Hello, World!')",
  "bundled": false,
  "selection": false
}
```

**Bundle Execute Request:**
```json
{
  "type": "bundle_execute",
  "code": "-- Your bundled code here",
  "bundled": true,
  "selection": false
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat"
}
```

**Response:**
```json
{
  "type": "response",
  "success": true,
  "output": "Hello, World!",
  "error": null
}
```

## Executor-Side Implementation

See `examples/executor.luau` for a complete WebSocket server implementation that handles commands from the extension.

## Exploit Functions

The extension provides IntelliSense and documentation for 50+ exploit functions:

### Categories
- **Environment**: `getgenv`, `getrenv`, `getfenv`, `setfenv`
- **Hooking**: `hookfunction`, `hookmetamethod`
- **Script**: `getsenv`, `getcallingscript`, `getscriptclosure`, `decompile`
- **Instance**: `getnilinstances`, `fireclickdetector`, `fireproximityprompt`
- **Metatable**: `getrawmetatable`, `setrawmetatable`, `setreadonly`, `isreadonly`
- **Closure**: `islclosure`, `iscclosure`, `newcclosure`, `checkcaller`
- **Utility**: `setclipboard`, `setfflag`, `getfflag`
- **Filesystem**: `readfile`, `writefile`, `isfile`, `makefolder`, `listfiles`
- **Network**: `request`, `http_request`
- **Debug**: `getinfo`, `getconstants`, `getupvalues`, `getconnections`
- **Identity**: `getidentity`, `setidentity`
- **Misc**: `loadstring`, `saveinstance`, `identifyexecutor`

## Commands

| Command | Keybind | Description |
|---------|---------|-------------|
| Execute Script | F5 | Execute entire file |
| Execute Selection | Shift+F5 | Execute selected code |
| Bundle and Execute | - | Bundle then execute |
| Connect to Executor | - | Connect to WebSocket server |
| Disconnect from Executor | - | Disconnect from server |

## Project Structure

```
ExploUtor/
├── src/
│   ├── core/
│   │   ├── websocket.ts       # WebSocket connection manager
│   │   ├── executor.ts        # Execution engine
│   │   └── bundler.ts         # Bundler integration
│   ├── language/
│   │   ├── luauProvider.ts    # LSP provider
│   │   ├── exploitSignatures.ts # Function definitions
│   │   └── completions.ts     # IntelliSense providers
│   ├── ui/
│   │   ├── statusBar.ts       # Status bar manager
│   │   └── outputChannel.ts   # Output panel
│   └── extension.ts           # Entry point
├── syntaxes/
│   └── luau.tmLanguage.json   # Syntax highlighting
├── package.json               # Extension manifest
└── tsconfig.json             # TypeScript config
```

## Development

Build and watch for changes:
```bash
npm run watch
```

Run tests:
```bash
npm test
```

Package extension:
```bash
npm install -g vsce
vsce package
```

## License

MIT

## Author

Created for Roblox exploit development and educational purposes.
