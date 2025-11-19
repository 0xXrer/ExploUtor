--[[
    ExploUtor Client Script with Error Handling

    This script demonstrates proper error handling and uses the 'request'
    function instead of HttpService for all HTTP operations.

    Features:
    - WebSocket connection to ExploUtor VSCode extension
    - Comprehensive error handling and reporting
    - Uses 'request' for HTTP operations (NOT HttpService)
    - Automatic reconnection on disconnect
    - Detailed logging system
]]

-- ============================================================================
-- Configuration
-- ============================================================================

local CONFIG = {
    WEBSOCKET_URL = "ws://localhost:9999",
    RECONNECT_DELAY = 5,
    HEARTBEAT_INTERVAL = 30,
    LOG_ERRORS = true,
    LOG_FILE = "exploitor_errors.log"
}

-- ============================================================================
-- Logging System
-- ============================================================================

local Logger = {}

function Logger.log(level, message, ...)
    local timestamp = os.date("%Y-%m-%d %H:%M:%S")
    local args = {...}
    local fullMessage = string.format(message, unpack(args))
    local logEntry = string.format("[%s] [%s] %s", timestamp, level, fullMessage)

    -- Print to console
    if level == "ERROR" then
        warn(logEntry)
    else
        print(logEntry)
    end

    -- Write to file if logging enabled
    if CONFIG.LOG_ERRORS and (level == "ERROR" or level == "WARN") then
        local success = pcall(function()
            if not isfolder("logs") then
                makefolder("logs")
            end
            appendfile("logs/" .. CONFIG.LOG_FILE, logEntry .. "\n")
        end)

        if not success then
            warn("Failed to write to log file")
        end
    end
end

function Logger.info(message, ...)
    Logger.log("INFO", message, ...)
end

function Logger.warn(message, ...)
    Logger.log("WARN", message, ...)
end

function Logger.error(message, ...)
    Logger.log("ERROR", message, ...)
end

function Logger.debug(message, ...)
    Logger.log("DEBUG", message, ...)
end

-- ============================================================================
-- Error Handler
-- ============================================================================

local ErrorHandler = {}

function ErrorHandler.wrap(func, context)
    return function(...)
        local success, result = pcall(func, ...)

        if not success then
            Logger.error("%s error: %s", context or "Unknown", tostring(result))

            -- Send error notification to VSCode
            ErrorHandler.notifyError(context, result)

            return nil, result
        end

        return result
    end
end

function ErrorHandler.notifyError(context, error)
    -- This will be called by the WebSocket client to send errors back to VSCode
    if _G.ExploitorClient and _G.ExploitorClient.sendError then
        pcall(_G.ExploitorClient.sendError, context, tostring(error))
    end
end

-- ============================================================================
-- Request Wrapper (DO NOT USE HttpService!)
-- ============================================================================

local RequestHelper = {}

function RequestHelper.get(url, headers)
    local success, response = pcall(function()
        return request({
            Url = url,
            Method = "GET",
            Headers = headers or {}
        })
    end)

    if not success then
        Logger.error("Request failed: %s", tostring(response))
        return nil, response
    end

    if not response.Success then
        Logger.error("HTTP error %d: %s", response.StatusCode, response.StatusMessage)
        return nil, response.StatusMessage
    end

    return response
end

function RequestHelper.post(url, body, headers)
    local defaultHeaders = {
        ["Content-Type"] = "application/json"
    }

    if headers then
        for k, v in pairs(headers) do
            defaultHeaders[k] = v
        end
    end

    local success, response = pcall(function()
        return request({
            Url = url,
            Method = "POST",
            Headers = defaultHeaders,
            Body = body
        })
    end)

    if not success then
        Logger.error("POST request failed: %s", tostring(response))
        return nil, response
    end

    if not response.Success then
        Logger.error("HTTP POST error %d: %s", response.StatusCode, response.StatusMessage)
        return nil, response.StatusMessage
    end

    return response
end

-- ============================================================================
-- JSON Helper (Safe wrapper for HttpService JSONEncode/Decode)
-- ============================================================================

local JSON = {}
local HttpService = game:GetService("HttpService")

function JSON.encode(data)
    local success, result = pcall(HttpService.JSONEncode, HttpService, data)

    if not success then
        Logger.error("JSON encode failed: %s", tostring(result))
        return nil, result
    end

    return result
end

function JSON.decode(str)
    local success, result = pcall(HttpService.JSONDecode, HttpService, str)

    if not success then
        Logger.error("JSON decode failed: %s", tostring(result))
        return nil, result
    end

    return result
end

-- ============================================================================
-- WebSocket Client
-- ============================================================================

local ExploitorClient = {}
ExploitorClient.__index = ExploitorClient

function ExploitorClient.new(url)
    local self = setmetatable({}, ExploitorClient)

    self.url = url
    self.ws = nil
    self.connected = false
    self.reconnecting = false
    self.messageHandlers = {}

    -- Register default message handlers
    self:registerHandler("execute", self.handleExecute)
    self:registerHandler("bundle_execute", self.handleBundleExecute)
    self:registerHandler("ping", self.handlePing)

    return self
end

function ExploitorClient:connect()
    if self.connected then
        Logger.warn("Already connected to ExploUtor")
        return true
    end

    Logger.info("Connecting to ExploUtor at %s...", self.url)

    local success, ws = pcall(function()
        return WebSocket.connect(self.url)
    end)

    if not success then
        Logger.error("Failed to create WebSocket connection: %s", tostring(ws))
        self:scheduleReconnect()
        return false
    end

    self.ws = ws
    self.connected = true

    -- Set up event handlers
    ws.OnMessage:Connect(ErrorHandler.wrap(function(message)
        self:handleMessage(message)
    end, "WebSocket.OnMessage"))

    ws.OnClose:Connect(ErrorHandler.wrap(function()
        self:handleClose()
    end, "WebSocket.OnClose"))

    -- Send hello message
    self:sendMessage({
        type = "hello",
        executor = identifyexecutor(),
        timestamp = os.time()
    })

    Logger.info("Successfully connected to ExploUtor")

    return true
end

function ExploitorClient:disconnect()
    if not self.connected then
        return
    end

    Logger.info("Disconnecting from ExploUtor...")

    self.connected = false

    if self.ws then
        pcall(function()
            self.ws:Close()
        end)
        self.ws = nil
    end
end

function ExploitorClient:handleClose()
    Logger.warn("WebSocket connection closed")

    self.connected = false
    self.ws = nil

    if not self.reconnecting then
        self:scheduleReconnect()
    end
end

function ExploitorClient:scheduleReconnect()
    if self.reconnecting then
        return
    end

    self.reconnecting = true

    Logger.info("Attempting to reconnect in %d seconds...", CONFIG.RECONNECT_DELAY)

    task.delay(CONFIG.RECONNECT_DELAY, function()
        self.reconnecting = false
        self:connect()
    end)
end

function ExploitorClient:registerHandler(messageType, handler)
    self.messageHandlers[messageType] = handler
end

function ExploitorClient:handleMessage(message)
    Logger.debug("Received message: %s", message:sub(1, 100))

    local data, err = JSON.decode(message)

    if not data then
        Logger.error("Failed to parse message JSON: %s", tostring(err))
        self:sendError("JSON Parse", err)
        return
    end

    local messageType = data.type

    if not messageType then
        Logger.error("Message missing 'type' field")
        self:sendError("Invalid Message", "Missing type field")
        return
    end

    local handler = self.messageHandlers[messageType]

    if not handler then
        Logger.warn("No handler for message type: %s", messageType)
        return
    end

    -- Execute handler with error handling
    local success, result = pcall(handler, self, data)

    if not success then
        Logger.error("Handler error for type '%s': %s", messageType, tostring(result))
        self:sendError("Handler: " .. messageType, result)
    end
end

function ExploitorClient:handleExecute(data)
    Logger.info("Executing code from ExploUtor...")

    if not data.code then
        Logger.error("Execute message missing code field")
        self:sendResponse(false, nil, "Missing code field")
        return
    end

    -- Compile the code
    local func, compileErr = loadstring(data.code)

    if not func then
        Logger.error("Compilation error: %s", tostring(compileErr))
        self:sendResponse(false, nil, "Compilation error: " .. tostring(compileErr))
        return
    end

    -- Execute the code
    local execSuccess, execResult = pcall(func)

    if not execSuccess then
        Logger.error("Runtime error: %s", tostring(execResult))
        self:sendResponse(false, nil, "Runtime error: " .. tostring(execResult))
        return
    end

    Logger.info("Code executed successfully")
    self:sendResponse(true, tostring(execResult or ""), nil)
end

function ExploitorClient:handleBundleExecute(data)
    Logger.info("Executing bundled code from ExploUtor...")

    -- Same as execute, bundled code is pre-processed
    self:handleExecute(data)
end

function ExploitorClient:handlePing(data)
    Logger.debug("Received ping, sending pong...")

    self:sendMessage({
        type = "pong",
        timestamp = os.time()
    })
end

function ExploitorClient:sendMessage(data)
    if not self.connected or not self.ws then
        Logger.error("Cannot send message: not connected")
        return false
    end

    local json, err = JSON.encode(data)

    if not json then
        Logger.error("Failed to encode message: %s", tostring(err))
        return false
    end

    local success, sendErr = pcall(function()
        self.ws:Send(json)
    end)

    if not success then
        Logger.error("Failed to send message: %s", tostring(sendErr))
        return false
    end

    return true
end

function ExploitorClient:sendResponse(success, output, error)
    self:sendMessage({
        type = "response",
        success = success,
        output = output,
        error = error,
        timestamp = os.time()
    })
end

function ExploitorClient:sendError(context, error)
    self:sendMessage({
        type = "error",
        context = context,
        error = tostring(error),
        timestamp = os.time()
    })
end

-- ============================================================================
-- Main Initialization
-- ============================================================================

Logger.info("==========================================================")
Logger.info("ExploUtor Client Script Starting...")
Logger.info("==========================================================")

-- Create and start the client
local client = ExploitorClient.new(CONFIG.WEBSOCKET_URL)
_G.ExploitorClient = client

local success = client:connect()

if not success then
    Logger.error("Failed to start ExploUtor client")
    Logger.error("Make sure the VSCode extension is running and listening on %s", CONFIG.WEBSOCKET_URL)
else
    Logger.info("ExploUtor client is ready!")
    Logger.info("Connected to VSCode extension")
end

-- Keep the script running
while true do
    task.wait(CONFIG.HEARTBEAT_INTERVAL)

    if client.connected then
        Logger.debug("Heartbeat: Client still connected")
    end
end
