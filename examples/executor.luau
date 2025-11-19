--[[
    ExploUtor Executor-Side WebSocket Client

    This script runs inside the Roblox executor and connects to the
    VSCode extension via WebSocket on port 9999.

    Requirements:
    - WebSocket.connect (UNC Standard)
    - HttpService (for JSON)

    Usage:
    1. Start the VSCode extension (Server)
    2. Execute this script in your executor
]]

local HttpService = game:GetService("HttpService")

-- Configuration
local CONFIG = {
    URL = "ws://localhost:9999",
    RECONNECT_INTERVAL = 5
}

local ws
local connected = false

-- Message handlers
local messageHandlers = {}

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

messageHandlers["debug_event"] = function(message)
    -- Placeholder for debug event handling
    -- In a real implementation, this would interact with the debug library
    print("[ExploUtor] Received debug event: " .. tostring(message.debugType))
    return nil
end

-- Handle incoming WebSocket message
local function handleMessage(data)
    local success, message = pcall(function()
        return HttpService:JSONDecode(data)
    end)

    if not success then
        warn("[ExploUtor] Failed to parse message: " .. tostring(message))
        return
    end

    -- print("[ExploUtor] Received message type: " .. tostring(message.type))

    local handler = messageHandlers[message.type]
    if handler then
        local response = handler(message)

        if response and ws then
            local responseJson = HttpService:JSONEncode(response)
            ws:Send(responseJson)
            -- print("[ExploUtor] Sent response")
        end
    elseif message.type ~= "heartbeat" then
        warn("[ExploUtor] Unknown message type: " .. tostring(message.type))
    end
end

-- Connect to WebSocket Server
local function connect()
    print("[ExploUtor] Connecting to " .. CONFIG.URL .. "...")

    local success, socket = pcall(function()
        return WebSocket.connect(CONFIG.URL)
    end)

    if not success then
        warn("[ExploUtor] Connection failed: " .. tostring(socket))
        return false
    end

    ws = socket
    connected = true
    print("[ExploUtor] Connected to VSCode!")

    ws.OnMessage:Connect(function(message)
        handleMessage(message)
    end)

    ws.OnClose:Connect(function()
        print("[ExploUtor] Disconnected from VSCode")
        connected = false
        ws = nil
        
        -- Attempt reconnect
        task.delay(CONFIG.RECONNECT_INTERVAL, function()
            if not connected then
                connect()
            end
        end)
    end)

    -- Send hello/handshake
    local handshake = {
        type = "response",
        success = true,
        output = "Connected to ExploUtor executor (" .. (identifyexecutor and identifyexecutor() or "Unknown") .. ")"
    }
    ws:Send(HttpService:JSONEncode(handshake))

    return true
end

-- Start connection
task.spawn(function()
    if not connect() then
        -- If initial connection fails, retry loop
        while not connected do
            task.wait(CONFIG.RECONNECT_INTERVAL)
            connect()
        end
    end
end)

-- Enhanced execution context
local env = getgenv()
env._exploUtor_print = print
env.print = function(...)
    local args = {...}
    local output = table.concat(args, " ")
    -- Send output back to VSCode if connected
    if connected and ws then
        local msg = {
            type = "response",
            output = output
        }
        ws:Send(HttpService:JSONEncode(msg))
    end
    env._exploUtor_print(...)
end
