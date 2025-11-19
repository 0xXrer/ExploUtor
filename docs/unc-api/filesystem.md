# Filesystem API

The filesystem functions provide read/write access to a designated workspace folder on your computer.

---

## File Operations

### readfile

```lua
function readfile(path: string): string
```

Returns the contents of the file located at `path`.

**Example:**
```lua
local content = readfile("config.txt")
print(content)
```

---

### writefile

```lua
function writefile(path: string, data: string): ()
```

Writes `data` to the file located at `path`. If the file exists, it will be overwritten. Creates the file if it doesn't exist.

**Example:**
```lua
writefile("config.txt", "AutoFarm = true\nSpeed = 50")
```

---

### appendfile

```lua
function appendfile(path: string, data: string): ()
```

Appends `data` to the end of the file located at `path`. Creates the file if it does not exist.

**Example:**
```lua
appendfile("log.txt", os.date() .. " - Script executed\n")
```

---

### delfile

```lua
function delfile(path: string): ()
```

Deletes the file at the specified `path`.

**Example:**
```lua
if isfile("temp.txt") then
    delfile("temp.txt")
end
```

---

## Folder Operations

### listfiles

```lua
function listfiles(path: string): {string}
```

Returns a list of files and folders in the folder located at `path`.

**Example:**
```lua
local files = listfiles("scripts")
for _, file in ipairs(files) do
    print(file)
end
```

---

### makefolder

```lua
function makefolder(path: string): ()
```

Creates a folder at `path` if it does not already exist.

**Example:**
```lua
makefolder("configs")
makefolder("configs/game123")
```

---

### delfolder

```lua
function delfolder(path: string): ()
```

Deletes the folder at the specified `path`.

**Example:**
```lua
if isfolder("temp") then
    delfolder("temp")
end
```

---

## Check Functions

### isfile

```lua
function isfile(path: string): boolean
```

Returns whether or not `path` points to a file.

**Example:**
```lua
if isfile("config.json") then
    local config = readfile("config.json")
end
```

---

### isfolder

```lua
function isfolder(path: string): boolean
```

Returns whether or not `path` points to a folder.

**Example:**
```lua
if not isfolder("scripts") then
    makefolder("scripts")
end
```

---

## Code Execution

### loadfile

```lua
function loadfile(path: string, chunkname?: string): function?
```

Generates a chunk from the file located at `path`. The environment of the returned function is the global environment. Returns `nil` if the file cannot be loaded.

**Example:**
```lua
local func = loadfile("script.lua")
if func then
    func() -- Execute the loaded function
end
```

---

### dofile

```lua
function dofile(path: string): ()
```

Attempts to load the file located at `path` and execute it on a new thread.

**Example:**
```lua
dofile("autoexec/init.lua")
```

---

## Practical Examples

### Configuration System

```lua
local CONFIG_PATH = "configs/mygame.json"

local function loadConfig()
    if not isfolder("configs") then
        makefolder("configs")
    end

    if isfile(CONFIG_PATH) then
        local content = readfile(CONFIG_PATH)
        -- Parse JSON (assuming you have a json library)
        return content
    else
        -- Default config
        local defaultConfig = [[{
    "autoFarm": false,
    "speed": 16,
    "jump": 50
}]]
        writefile(CONFIG_PATH, defaultConfig)
        return defaultConfig
    end
end

local function saveConfig(configData)
    writefile(CONFIG_PATH, configData)
end

-- Usage
local config = loadConfig()
print("Config loaded:", config)
```

### Script Manager

```lua
local SCRIPTS_FOLDER = "scripts"

-- Ensure scripts folder exists
if not isfolder(SCRIPTS_FOLDER) then
    makefolder(SCRIPTS_FOLDER)
end

-- List all scripts
local function listScripts()
    local scripts = {}
    local files = listfiles(SCRIPTS_FOLDER)

    for _, filepath in ipairs(files) do
        if isfile(filepath) and filepath:match("%.lua$") then
            local name = filepath:match("([^/\\]+)%.lua$")
            table.insert(scripts, {
                name = name,
                path = filepath
            })
        end
    end

    return scripts
end

-- Execute a script
local function executeScript(scriptName)
    local path = SCRIPTS_FOLDER .. "/" .. scriptName .. ".lua"

    if not isfile(path) then
        warn("Script not found:", scriptName)
        return false
    end

    local success, err = pcall(dofile, path)
    if not success then
        warn("Script error:", err)
        return false
    end

    return true
end

-- Usage
local scripts = listScripts()
print("Available scripts:")
for _, script in ipairs(scripts) do
    print("-", script.name)
end

executeScript("autofarm")
```

### Logging System

```lua
local LOG_FILE = "logs/activity.log"

-- Ensure logs folder exists
if not isfolder("logs") then
    makefolder("logs")
end

local function log(level, message)
    local timestamp = os.date("%Y-%m-%d %H:%M:%S")
    local logEntry = string.format("[%s] [%s] %s\n", timestamp, level, message)

    appendfile(LOG_FILE, logEntry)

    if level == "ERROR" then
        warn(logEntry)
    else
        print(logEntry)
    end
end

-- Usage
log("INFO", "Script started")
log("DEBUG", "Loading configuration...")
log("ERROR", "Failed to connect to server")
```

### Auto-Execute System

```lua
local AUTOEXEC_FOLDER = "autoexec"

if not isfolder(AUTOEXEC_FOLDER) then
    makefolder(AUTOEXEC_FOLDER)
    print("Created autoexec folder")
end

local function runAutoExecScripts()
    local files = listfiles(AUTOEXEC_FOLDER)

    for _, filepath in ipairs(files) do
        if isfile(filepath) and filepath:match("%.lua$") then
            print("Auto-executing:", filepath)

            local success, err = pcall(dofile, filepath)
            if not success then
                warn("Auto-exec error:", err)
            end
        end
    end
end

-- Run all auto-exec scripts
runAutoExecScripts()
```

---

## Important Notes

- All paths are relative to the executor's workspace folder
- Path separators can be either `/` or `\\`
- File operations may fail silently on some executors
- Always check if files/folders exist before operating on them
- Use pcall for error handling with file operations
