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

For a more advanced client with comprehensive error handling, see `examples/client-with-errors.luau`.

## Exploit Functions

The extension provides IntelliSense and documentation for **100+ exploit functions** based on the Unified Naming Convention (UNC) standard:

### Categories
- **Environment**: `getgenv`, `getrenv`, `getfenv`, `setfenv`
- **Hooking**: `hookfunction`, `hookmetamethod`
- **Script**: `getsenv`, `getcallingscript`, `getscriptclosure`, `decompile`, `getloadedmodules`, `getrunningscripts`, `getscripts`, `getgc`
- **Instance**: `getnilinstances`, `getinstances`, `fireclickdetector`, `fireproximityprompt`, `gethiddenproperty`, `sethiddenproperty`, `gethui`, `getcustomasset`
- **Metatable**: `getrawmetatable`, `setrawmetatable`, `setreadonly`, `isreadonly`
- **Closure**: `islclosure`, `iscclosure`, `newcclosure`, `checkcaller`, `clonefunction`
- **Utility**: `setclipboard`, `setfflag`, `getfflag`
- **Filesystem**: `readfile`, `writefile`, `appendfile`, `isfile`, `isfolder`, `makefolder`, `listfiles`, `delfile`, `delfolder`, `loadfile`, `dofile`
- **Network**: `request`, `http_request`, `WebSocket.connect`
- **Cache**: `cloneref`, `compareinstances`
- **Crypt**: `crypt.base64encode`, `crypt.base64decode`, `crypt.encrypt`, `crypt.decrypt`, `crypt.generatekey`, `crypt.hash`
- **Console**: `rconsolecreate`, `rconsoledestroy`, `rconsoleclear`, `rconsoleprint`, `rconsoleinput`, `rconsolesettitle`
- **Drawing**: `Drawing.new`, `cleardrawcache`, `getrenderproperty`, `setrenderproperty`, `isrenderobj`
- **Input**: `isrbxactive`, `mouse1click`, `mouse2click`, `mousemoveabs`, `mousemoverel`, `mousescroll`
- **Debug**: `getinfo`, `getconstants`, `getupvalues`, `getconnections`, `debug.getconstant`, `debug.setconstant`, `debug.getupvalue`, `debug.setupvalue`, `debug.getproto`, `debug.getprotos`, `debug.getstack`, `debug.setstack`
- **Identity**: `getidentity`, `setidentity`, `getthreadidentity`, `setthreadidentity`
- **Misc**: `loadstring`, `saveinstance`, `identifyexecutor`, `queue_on_teleport`, `setfpscap`, `lz4compress`, `lz4decompress`, `messagebox`

### Full Documentation

Comprehensive documentation for all UNC functions is available in the `docs/unc-api/` folder:

- **[UNC API Overview](docs/unc-api/README.md)** - Introduction and usage guidelines
- **[Request API](docs/unc-api/request.md)** - HTTP requests (use `request`, NOT HttpService!)
- **[WebSocket API](docs/unc-api/websocket.md)** - Real-time WebSocket connections
- **[Filesystem API](docs/unc-api/filesystem.md)** - File and folder operations

### Important: Use `request` Instead of HttpService

**DO NOT use HttpService** for HTTP requests in exploit scripts. Always use the `request` function:

```lua
-- ❌ WRONG
local HttpService = game:GetService("HttpService")
local response = HttpService:GetAsync("https://example.com")

-- ✅ CORRECT
local response = request({
    Url = "https://example.com",
    Method = "GET"
})

if response.Success then
    print("Status:", response.StatusCode)
    print("Body:", response.Body)
end
```

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
├── .github/
│   └── workflows/
│       └── build-vsix.yml     # CI workflow for building VSIX
├── src/
│   ├── core/
│   │   ├── websocket.ts       # WebSocket connection manager
│   │   ├── executor.ts        # Execution engine
│   │   └── bundler.ts         # Bundler integration
│   ├── language/
│   │   ├── luauProvider.ts    # LSP provider
│   │   ├── exploitSignatures.ts # UNC function definitions (100+ functions)
│   │   └── completions.ts     # IntelliSense providers
│   ├── ui/
│   │   ├── statusBar.ts       # Status bar manager
│   │   └── outputChannel.ts   # Output panel
│   └── extension.ts           # Entry point
├── docs/
│   └── unc-api/               # UNC API documentation
│       ├── README.md          # Overview and usage guidelines
│       ├── request.md         # HTTP request documentation
│       ├── websocket.md       # WebSocket documentation
│       └── filesystem.md      # Filesystem documentation
├── examples/
│   ├── executor.luau          # Basic executor WebSocket server
│   ├── client-with-errors.luau # Advanced client with error handling
│   └── example.luau           # Example script
├── syntaxes/
│   └── luau.tmLanguage.json   # Syntax highlighting
├── package.json               # Extension manifest
└── tsconfig.json             # TypeScript config
```

## Continuous Integration

The repository includes a GitHub Actions workflow that automatically:
- Compiles TypeScript
- Runs linting
- Packages the extension as a VSIX file
- Uploads the VSIX as an artifact
- Creates releases when tags are pushed

To trigger a release:
```bash
git tag v0.1.0
git push origin v0.1.0
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
