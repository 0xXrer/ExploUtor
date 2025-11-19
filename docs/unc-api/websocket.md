# WebSocket API

The **WebSocket** class provides a simple interface for sending and receiving data over a WebSocket connection for real-time bidirectional communication.

---

## WebSocket.connect

`🏛️ Constructor`

```lua
function WebSocket.connect(url: string): WebSocket
```

Establishes a WebSocket connection to the specified URL.

### Parameters

- `url` - The WebSocket URL to connect to (must start with `ws://` or `wss://`)

### Returns

Returns a WebSocket instance with methods and events for communication.

---

## WebSocket Class

```lua
local ws = WebSocket.connect(url)
```

### Methods

| Method | Description |
| ------ | ----------- |
| `Send(message: string): ()` | Sends a message over the WebSocket connection |
| `Close(): ()` | Closes the WebSocket connection |

### Events

| Event | Description |
| ----- | ----------- |
| `OnMessage: RBXScriptSignal<string>` | Fired when a message is received over the WebSocket connection |
| `OnClose: RBXScriptSignal<>` | Fired when the WebSocket connection is closed |

---

## Examples

### Basic WebSocket Connection

```lua
local ws = WebSocket.connect("ws://localhost:8080")

ws.OnMessage:Connect(function(message)
    print("Received:", message)
end)

ws.OnClose:Connect(function()
    print("Connection closed")
end)

ws:Send("Hello, World!")
```

### WebSocket Client for ExploUtor

```lua
-- Connect to ExploUtor VSCode extension
local ws = WebSocket.connect("ws://localhost:9999")

local connected = false

ws.OnMessage:Connect(function(message)
    print("[ExploUtor]", message)

    -- Parse JSON message
    local success, data = pcall(function()
        return game:GetService("HttpService"):JSONDecode(message)
    end)

    if success and data.type == "execute" then
        -- Execute code received from VSCode
        local execSuccess, execError = pcall(function()
            loadstring(data.code)()
        end)

        -- Send response back
        local response = {
            type = "response",
            success = execSuccess,
            error = execSuccess and nil or tostring(execError)
        }

        ws:Send(game:GetService("HttpService"):JSONEncode(response))
    end
end)

ws.OnClose:Connect(function()
    print("[ExploUtor] Disconnected from VSCode")
    connected = false
end)

-- Send hello message
ws:Send(game:GetService("HttpService"):JSONEncode({
    type = "hello",
    executor = identifyexecutor()
}))

connected = true
print("[ExploUtor] Connected to VSCode extension")
```

### WebSocket with Error Handling

```lua
local function createWebSocketClient(url)
    local success, ws = pcall(function()
        return WebSocket.connect(url)
    end)

    if not success then
        warn("Failed to connect to WebSocket:", ws)
        return nil
    end

    local client = {
        ws = ws,
        connected = true
    }

    ws.OnMessage:Connect(function(message)
        if client.onMessage then
            local success, err = pcall(client.onMessage, message)
            if not success then
                warn("Error in message handler:", err)
            end
        end
    end)

    ws.OnClose:Connect(function()
        client.connected = false
        if client.onClose then
            pcall(client.onClose)
        end
    end)

    function client:send(message)
        if not self.connected then
            warn("Cannot send: WebSocket not connected")
            return false
        end

        local success, err = pcall(function()
            self.ws:Send(message)
        end)

        if not success then
            warn("Failed to send message:", err)
            return false
        end

        return true
    end

    function client:close()
        if self.connected then
            pcall(function()
                self.ws:Close()
            end)
            self.connected = false
        end
    end

    return client
end

-- Usage
local client = createWebSocketClient("ws://localhost:9999")
if client then
    client.onMessage = function(msg)
        print("Received:", msg)
    end

    client.onClose = function()
        print("Connection closed")
    end

    client:send("Hello!")
end
```

### JSON Message Protocol

```lua
local HttpService = game:GetService("HttpService")
local ws = WebSocket.connect("ws://localhost:9999")

local messageHandlers = {}

-- Register message handlers
messageHandlers.execute = function(data)
    local success, result = pcall(loadstring, data.code)
    if success then
        local execSuccess, execResult = pcall(result)
        return {
            type = "response",
            success = execSuccess,
            result = execSuccess and tostring(execResult) or nil,
            error = execSuccess and nil or tostring(execResult)
        }
    else
        return {
            type = "response",
            success = false,
            error = "Failed to compile: " .. tostring(result)
        }
    end
end

messageHandlers.ping = function(data)
    return { type = "pong", timestamp = os.time() }
end

-- Handle incoming messages
ws.OnMessage:Connect(function(message)
    local success, data = pcall(HttpService.JSONDecode, HttpService, message)

    if not success then
        warn("Failed to parse JSON:", data)
        return
    end

    local handler = messageHandlers[data.type]
    if handler then
        local response = handler(data)
        if response then
            local responseJson = HttpService:JSONEncode(response)
            ws:Send(responseJson)
        end
    else
        warn("Unknown message type:", data.type)
    end
end)

ws.OnClose:Connect(function()
    print("WebSocket closed")
end)
```

---

## Notes

- WebSocket connections are asynchronous and event-driven
- Always handle connection errors with pcall
- The connection will automatically close when the script stops
- Some executors may have connection limits or restrictions
- For secure connections, use `wss://` instead of `ws://`
