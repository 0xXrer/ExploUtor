-- Test Script for ExploUtor Obfuscator Opcodes

-- Arithmetic
local a = 10
local b = 20
local c = a + b
local d = b - a
local e = a * 2
local f = b / 2
local g = b % 3
local h = 2 ^ 3
local i = -a

print("Arithmetic:", c, d, e, f, g, h, i)

-- Logic
local t = true
local fl = false
local l1 = not t
local l2 = # "hello"
local l3 = "hello" .. " world"

print("Logic:", l1, l2, l3)

-- Comparison
local eq = (a == 10)
local neq = (a ~= 20)
local lt = (a < b)
local le = (a <= 10)
local gt = (b > a)
local ge = (b >= 20)

print("Comparison:", eq, neq, lt, le, gt, ge)

-- Tables
local tbl = {
    key1 = "value1",
    key2 = 100,
    ["complex key"] = true
}

tbl.newKey = "newValue"
print("Table:", tbl.key1, tbl["key2"], tbl.newKey)

-- Control Flow (Basic)
if a < b then
    print("a is less than b")
end

local function testFunc(x, y)
    return x + y
end

print("Function Call:", testFunc(5, 7))
