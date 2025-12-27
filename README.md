# ExploUtor

VS Code extension for Roblox exploit development with WebSocket-based script
execution, debugging tools, and MCP integration.

## Features

- **Script Execution**: Execute Lua code directly from VS Code
- **Upvalue Scanner**: Browse and modify closure upvalues
- **Constant Scanner**: View constants grouped by type
- **Script Scanner**: List all LocalScripts with source preview
- **Module Scanner**: List ModuleScripts with return values
- **Remote Spy**: Real-time logging of RemoteEvent/RemoteFunction calls
- **Closure Spy**: Monitor closure invocations
- **Inspector Panel**: Detailed view and editing for all items
- **MCP Server**: AI integration for automated analysis

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run compile
   ```
4. Press F5 to launch Extension Development Host

## Configuration

| Setting                        | Default     | Description                   |
| ------------------------------ | ----------- | ----------------------------- |
| `exploitor.websocket.host`     | `localhost` | WebSocket server host         |
| `exploitor.websocket.port`     | `8080`      | WebSocket server port         |
| `exploitor.autoConnect`        | `true`      | Auto-connect on startup       |
| `exploitor.remoteSpy.enabled`  | `false`     | Enable Remote Spy on connect  |
| `exploitor.closureSpy.enabled` | `false`     | Enable Closure Spy on connect |
| `exploitor.mcp.enabled`        | `true`      | Enable MCP server             |
| `exploitor.mcp.port`           | `3000`      | MCP server port               |

## Commands

| Command                        | Description           |
| ------------------------------ | --------------------- |
| `ExploUtor: Connect`           | Connect to executor   |
| `ExploUtor: Disconnect`        | Disconnect            |
| `ExploUtor: Execute Selection` | Execute selected code |
| `ExploUtor: Execute File`      | Execute current file  |
| `ExploUtor: Scan Upvalues`     | Refresh upvalue tree  |
| `ExploUtor: Scan Constants`    | Refresh constant tree |
| `ExploUtor: Scan Scripts`      | Refresh script tree   |
| `ExploUtor: Scan Modules`      | Refresh module tree   |

## Executor Setup

Load the Lua module in your executor:

```lua
local ExploUtor = loadstring(game:HttpGet("https://raw.githubusercontent.com/0xXrer/ExploUtor/refs/heads/main/lua/exploitor.lua"))()
ExploUtor.connect("localhost", 8080)
```

## Protocol

JSON-RPC 2.0 over WebSocket.

### Requests

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "execute",
    "params": { "code": "print('hello')" }
}
```

### Available Methods

- `execute` - Execute Lua code
- `get_place_info` - Get current place info
- `scan_upvalues` - Scan all upvalues
- `scan_constants` - Scan all constants
- `scan_scripts` - Scan LocalScripts
- `scan_modules` - Scan ModuleScripts
- `get_remotes` - List RemoteEvents/Functions
- `modify_upvalue` - Modify upvalue value
- `enable_remote_spy` - Toggle remote spy
- `enable_closure_spy` - Toggle closure spy

### Events

```json
{
    "jsonrpc": "2.0",
    "method": "remote_called",
    "params": {
        "remoteName": "MyRemote",
        "remoteType": "RemoteEvent",
        "arguments": "[...]",
        "traceback": "..."
    }
}
```

## MCP Tools

- `get_place_info` - Get place information
- `get_scripts` - List all scripts
- `get_remotes` - List all remotes
- `search_constants` - Search constants
- `search_upvalues` - Search upvalues

## Development

```bash
npm run watch    # Watch mode
npm run compile  # Build
npm run package  # Production build
npm run lint     # Lint
```

## License

MIT
