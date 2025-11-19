# UNC (Unified Naming Convention) API Documentation

This documentation provides a comprehensive reference for exploit functions based on the Unified Naming Convention standard.

## What is UNC?

The Unified Naming Convention (UNC) was a standardized API specification for Roblox script executors that aimed to provide consistent function names and behaviors across different executor platforms.

## API Categories

- **[WebSocket](./websocket.md)** - WebSocket connections for real-time communication
- **[Request](./request.md)** - HTTP request functions (use `request` instead of HttpService)
- **[Filesystem](./filesystem.md)** - File operations (read, write, list, etc.)
- **[Cache](./cache.md)** - Instance cache manipulation
- **[Closures](./closures.md)** - Function manipulation and hooking
- **[Console](./console.md)** - Console window management
- **[Crypt](./crypt.md)** - Encryption, decryption, and hashing
- **[Debug](./debug.md)** - Function introspection and modification
- **[Drawing](./drawing.md)** - 2D drawing API
- **[Input](./input.md)** - Mouse and keyboard input simulation
- **[Instances](./instances.md)** - Instance manipulation and introspection
- **[Metatable](./metatable.md)** - Metatable operations
- **[Misc](./misc.md)** - Miscellaneous utility functions
- **[Scripts](./scripts.md)** - Script environment and bytecode operations

## Important Notes

### Using `request` Instead of HttpService

**DO NOT use HttpService for HTTP requests in exploits.** Instead, use the `request` function:

```lua
-- ❌ WRONG - Don't use HttpService
local HttpService = game:GetService("HttpService")
local response = HttpService:GetAsync("https://example.com")

-- ✅ CORRECT - Use request function
local response = request({
    Url = "https://example.com",
    Method = "GET"
})

if response.Success then
    print("Status:", response.StatusCode)
    print("Body:", response.Body)
else
    warn("Request failed:", response.StatusMessage)
end
```

### Error Handling

Always implement proper error handling in your scripts:

```lua
local success, result = pcall(function()
    -- Your code here
    local response = request({
        Url = "https://api.example.com/data",
        Method = "GET"
    })

    if not response.Success then
        error("HTTP request failed: " .. response.StatusMessage)
    end

    return response.Body
end)

if not success then
    warn("Error occurred:", result)
end
```

## Usage in ExploUtor

The ExploUtor extension provides IntelliSense for all UNC functions. Simply start typing a function name to see its documentation, parameters, and usage examples.

## Reference

Based on the [Unified Naming Convention](https://github.com/unified-naming-convention/NamingStandard) standard.
