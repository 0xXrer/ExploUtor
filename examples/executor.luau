--[[
    ExploUtor Executor-Side WebSocket Server

    This script runs inside the Roblox executor and listens for commands
    from the VSCode extension via WebSocket on port 9999.

    Requirements:
    - WebSocket library (executor-specific)
    - JSON encode/decode functions

    Usage:
    1. Load this script in your executor
    2. Execute it to start the WebSocket server
    3. Connect from VSCode using "Connect to Executor" command
]]

local HttpService = game:GetService("HttpService")

-- Configuration
local CONFIG = {
    HOST = "0.0.0.0",
    PORT = 9999,
    HEARTBEAT_INTERVAL = 30
}

-- WebSocket server instance (replace with your executor's WebSocket library)
local WebSocketServer
local activeConnection

-- Message handlers
local messageHandlers = {}

-- Initialize WebSocket (executor-specific implementation)
local function initWebSocket()
    -- Example using a hypothetical WebSocket library
    -- Replace this with your executor's actual WebSocket implementation

    -- For Synapse X:
    -- WebSocketServer = syn.websocket.listen(CONFIG.PORT)

    -- For Script-Ware:
    -- WebSocketServer = http.listen(CONFIG.PORT)

    -- For generic executors with WebSocket support:
    -- WebSocketServer = websocket.listen(CONFIG.PORT)

    print("[ExploUtor] WebSocket server listening on port " .. CONFIG.PORT)

    return WebSocketServer
end

-- Execute Luau code safely
local function executeCode(code)
    local success, result = pcall(function()
        local func, loadErr = loadstring(code)
        if not func then
            return false, "Compilation error: " .. tostring(loadErr)
        end

        local execSuccess, execResult = pcall(func)
        if not execSuccess then
            return false, "Runtime error: " .. tostring(execResult)
        end

        return true, tostring(execResult or "")
    end)

    if not success then
        return false, "Execution error: " .. tostring(result)
    end

    return result
end

-- Message Handlers
messageHandlers["execute"] = function(message)
    print("[ExploUtor] Executing code...")

    local success, output = executeCode(message.code)

    return {
        type = "response",
        success = success,
        output = success and output or nil,
        error = not success and output or nil
    }
end

messageHandlers["bundle_execute"] = function(message)
    print("[ExploUtor] Executing bundled code...")

    local success, output = executeCode(message.code)

    return {
        type = "response",
        success = success,
        output = success and output or nil,
        error = not success and output or nil
    }
end

messageHandlers["heartbeat"] = function(message)
    -- Just acknowledge heartbeat
    return nil
end

-- Handle incoming WebSocket message
local function handleMessage(connection, data)
    local success, message = pcall(function()
        return HttpService:JSONDecode(data)
    end)

    if not success then
        warn("[ExploUtor] Failed to parse message: " .. tostring(message))
        return
    end

    print("[ExploUtor] Received message type: " .. tostring(message.type))

    local handler = messageHandlers[message.type]
    if handler then
        local response = handler(message)

        if response then
            local responseJson = HttpService:JSONEncode(response)
            connection:Send(responseJson)
            print("[ExploUtor] Sent response")
        end
    else
        warn("[ExploUtor] Unknown message type: " .. tostring(message.type))
    end
end

-- Main server loop
local function startServer()
    print("[ExploUtor] Starting WebSocket server...")

    local server = initWebSocket()

    if not server then
        error("[ExploUtor] Failed to initialize WebSocket server")
    end

    -- Handle new connections
    server.OnConnection = function(connection)
        print("[ExploUtor] New connection from: " .. tostring(connection.RemoteAddress))
        activeConnection = connection

        -- Send welcome message
        local welcome = {
            type = "response",
            success = true,
            output = "Connected to ExploUtor executor"
        }
        connection:Send(HttpService:JSONEncode(welcome))

        -- Handle incoming messages
        connection.OnMessage = function(data)
            handleMessage(connection, data)
        end

        -- Handle disconnection
        connection.OnClose = function()
            print("[ExploUtor] Connection closed")
            activeConnection = nil
        end
    end

    print("[ExploUtor] Server started successfully!")
    print("[ExploUtor] Waiting for connections on ws://" .. CONFIG.HOST .. ":" .. CONFIG.PORT)
end

-- Enhanced execution context with better error handling
local function createSafeExecutionEnvironment()
    local env = getgenv()

    -- Add custom print that captures output
    local outputBuffer = {}

    env._exploUtor_print = print
    env.print = function(...)
        local args = {...}
        local output = table.concat(args, " ")
        table.insert(outputBuffer, output)
        env._exploUtor_print(...)
    end

    env._exploUtor_getOutput = function()
        return table.concat(outputBuffer, "\n")
    end

    env._exploUtor_clearOutput = function()
        outputBuffer = {}
    end

    return env
end

-- Alternative: HTTP-based executor (if WebSocket not available)
local function startHttpServer()
    print("[ExploUtor] WebSocket not available, using HTTP polling...")

    -- This is a fallback for executors without WebSocket support
    -- Implement HTTP POST endpoint that polls for commands

    warn("[ExploUtor] HTTP polling not implemented. Please use an executor with WebSocket support.")
end

-- Start the appropriate server
local success, err = pcall(function()
    startServer()
end)

if not success then
    warn("[ExploUtor] Failed to start WebSocket server: " .. tostring(err))
    warn("[ExploUtor] Make sure your executor supports WebSocket connections")
end

--[[
    Example WebSocket implementations for different executors:

    1. Synapse X:
    ```lua
    local ws = syn.websocket.listen(9999)
    ws.OnConnection:Connect(function(conn)
        conn.OnMessage:Connect(function(msg)
            -- Handle message
        end)
    end)
    ```

    2. Script-Ware:
    ```lua
    local server = http.listen(9999)
    server.on_connection(function(conn)
        conn.on_message(function(msg)
            -- Handle message
        end)
    end)
    ```

    3. KRNL/Fluxus (using WebSocket library):
    ```lua
    local WebSocket = loadstring(game:HttpGet("https://raw.githubusercontent.com/your-ws-lib/main.lua"))()
    local server = WebSocket.Server.new(9999)
    server:on("connection", function(conn)
        conn:on("message", function(msg)
            -- Handle message
        end)
    end)
    ```
]]
