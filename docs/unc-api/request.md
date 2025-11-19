# Request API

The **request** function is the standard way to make HTTP requests in exploits. **DO NOT use HttpService** - always use the `request` function instead.

---

## request

`⏰ Yields`

```lua
function request(options: HttpRequest): HttpResponse
```

Sends an HTTP request using the specified options. Yields until the request is complete, and returns the response.

### Request Options

| Field | Type | Description |
| ----- | ---- | ----------- |
| `Url` | string | The URL for the request (required) |
| `Method` | string | The HTTP method: `GET`, `POST`, `PATCH`, or `PUT` |
| `Body` | string? | The body of the request (optional) |
| `Headers` | table? | A table of headers (optional) |
| `Cookies` | table? | A table of cookies (optional) |

### Response Object

| Field | Type | Description |
| ----- | ---- | ----------- |
| `Body` | string | The body of the response |
| `StatusCode` | number | The HTTP status code (e.g., 200, 404, 500) |
| `StatusMessage` | string | The status message (e.g., "OK", "Not Found") |
| `Success` | boolean | Whether the request was successful |
| `Headers` | table | A dictionary of response headers |

### Automatic Headers

The executor automatically provides these identification headers:

| Header | Description |
| ------ | ----------- |
| `PREFIX-User-Identifier` | A unique string for each user, consistent across computers |
| `PREFIX-Fingerprint` | The hardware identifier of the user |
| `User-Agent` | The name and version of the executor |

### Aliases

- `http.request`
- `http_request`

### Examples

#### Basic GET Request

```lua
local response = request({
    Url = "https://api.example.com/data",
    Method = "GET"
})

if response.Success then
    print("Status:", response.StatusCode, response.StatusMessage)
    print("Body:", response.Body)
else
    warn("Request failed:", response.StatusMessage)
end
```

#### POST Request with JSON

```lua
-- Note: Don't use HttpService for JSONEncode either!
-- Most executors provide a json library or you can use a pure Lua implementation

local data = {
    username = "player123",
    score = 1000
}

-- Using a json library (if available)
local json = loadstring(game:HttpGet("https://raw.githubusercontent.com/rxi/json.lua/master/json.lua"))()
local jsonBody = json.encode(data)

local response = request({
    Url = "https://api.example.com/scores",
    Method = "POST",
    Headers = {
        ["Content-Type"] = "application/json"
    },
    Body = jsonBody
})

if response.Success then
    print("Score submitted successfully!")
else
    warn("Failed to submit score:", response.StatusMessage)
end
```

#### Request with Custom Headers

```lua
local response = request({
    Url = "https://api.example.com/protected",
    Method = "GET",
    Headers = {
        ["Authorization"] = "Bearer your_token_here",
        ["Accept"] = "application/json"
    }
})
```

#### Error Handling Example

```lua
local function safeRequest(url, method, body)
    local success, response = pcall(function()
        return request({
            Url = url,
            Method = method or "GET",
            Body = body,
            Headers = {
                ["Content-Type"] = "application/json"
            }
        })
    end)

    if not success then
        warn("Request error:", response)
        return nil
    end

    if not response.Success then
        warn("HTTP error:", response.StatusCode, response.StatusMessage)
        return nil
    end

    return response
end

-- Usage
local response = safeRequest("https://api.example.com/data")
if response then
    print("Success:", response.Body)
end
```

---

## Why Not HttpService?

The `request` function provides several advantages over HttpService:

1. **Bypasses Roblox restrictions** - Can access any URL without whitelist limitations
2. **Full HTTP method support** - Supports GET, POST, PUT, PATCH, DELETE, etc.
3. **Custom headers** - Set any headers you need
4. **Better control** - Access to status codes, full response headers, etc.
5. **Standard in exploits** - Universally supported across executors

**Always use `request()` instead of HttpService in exploit scripts!**
