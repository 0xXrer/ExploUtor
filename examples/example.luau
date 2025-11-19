--[[
    ExploUtor Example Script

    This demonstrates the extension's features:
    - Syntax highlighting for Luau and exploit functions
    - IntelliSense auto-completion
    - Hover documentation
    - Execute with F5 or Execute Selection with Shift+F5
]]

-- Environment Functions
local env = getgenv()
env.MyGlobalVariable = "Hello from ExploUtor!"

local renv = getrenv()
print("Roblox environment:", renv)

-- Script Functions
local playerScripts = game.Players.LocalPlayer:WaitForChild("PlayerScripts")
local scriptEnv = getsenv(playerScripts)
print("Script environment:", scriptEnv)

-- Hooking Example
local oldPrint = hookfunction(print, function(...)
    return oldPrint("[HOOKED]", ...)
end)

print("This will be hooked!")

-- Metatable Manipulation
local mt = getrawmetatable(game)
setreadonly(mt, false)

local oldNamecall = mt.__namecall
mt.__namecall = function(self, ...)
    local method = getnamecallmethod()
    print("Namecall:", method)
    return oldNamecall(self, ...)
end

setreadonly(mt, true)

-- Instance Functions
local nilInstances = getnilinstances()
print("Found", #nilInstances, "nil instances")

-- Click detectors
for _, part in pairs(workspace:GetDescendants()) do
    if part:IsA("ClickDetector") then
        fireclickdetector(part)
        print("Clicked:", part:GetFullName())
    end
end

-- Filesystem Operations
if not isfolder("ExploUtor") then
    makefolder("ExploUtor")
end

writefile("ExploUtor/test.txt", "Hello, World!")
local content = readfile("ExploUtor/test.txt")
print("File content:", content)

-- Network Request
local response = request({
    Url = "https://httpbin.org/get",
    Method = "GET"
})

if response.Success then
    print("HTTP Response:", response.StatusCode)
    print("Body:", response.Body)
end

-- Utility Functions
setclipboard("Copied to clipboard!")
print("Clipboard set!")

-- Identity
local currentIdentity = getidentity()
print("Current identity:", currentIdentity)

-- Closure Checks
local function myFunction()
    return "Hello!"
end

print("Is Lua closure:", islclosure(myFunction))
print("Is C closure:", iscclosure(print))

-- Executor Info
local executor = identifyexecutor()
print("Running on:", executor)

-- Debug Functions
local connections = getconnections(workspace.ChildAdded)
print("Found", #connections, "connections to ChildAdded")

-- Loadstring
local code = [[
    print("Executed from loadstring!")
    return 42
]]

local func = loadstring(code)
local result = func()
print("Loadstring result:", result)

print("ExploUtor example completed successfully!")
