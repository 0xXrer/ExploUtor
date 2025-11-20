import * as vscode from 'vscode';

export interface Pattern {
    name: string;
    description: string;
    code: string;
    category: string;
}

export class PatternLibrary {
    private patterns: Pattern[] = [
        {
            name: 'Hook Detection Bypass',
            description: 'Common pattern to bypass checkcaller checks in hooks',
            category: 'Security',
            code: `
local old
old = hookfunction(target, function(...)
    if not checkcaller() then
        return old(...)
    end
    return old(...)
end)
`
        },
        {
            name: 'Metamethod Protection',
            description: 'Protect metamethod hooks with newcclosure and checkcaller',
            category: 'Security',
            code: `
local old
old = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)
    if not checkcaller() then
        return old(self, ...)
    end
    
    local method = getnamecallmethod()
    if method == "FireServer" then
        -- Logic here
    end
    
    return old(self, ...)
end))
`
        },
        {
            name: 'Remote Spy',
            description: 'Log all remote events and functions',
            category: 'Debugging',
            code: `
local old
old = hookmetamethod(game, "__namecall", newcclosure(function(self, ...)
    local method = getnamecallmethod()
    if method == "FireServer" or method == "InvokeServer" then
        print("Remote:", self.Name, "Method:", method)
        for i, v in ipairs({...}) do
            print("Arg", i, v)
        end
    end
    return old(self, ...)
end))
`
        },
        {
            name: 'Key System',
            description: 'Simple key system template',
            category: 'UI',
            code: `
local KeySystem = {}
KeySystem.Key = "SECRET_KEY"

function KeySystem:Check(input)
    return input == self.Key
end

-- Usage
local input = "SECRET_KEY"
if KeySystem:Check(input) then
    print("Access Granted")
else
    game.Players.LocalPlayer:Kick("Invalid Key")
end
`
        },
        {
            name: 'Auto Updater',
            description: 'Check for script updates from a URL',
            category: 'Utility',
            code: `
local currentVersion = "1.0.0"
local url = "https://raw.githubusercontent.com/user/repo/main/version.txt"

local success, latestVersion = pcall(function()
    return game:HttpGet(url)
end)

if success and latestVersion ~= currentVersion then
    print("New version available:", latestVersion)
    -- loadstring(game:HttpGet("script_url"))()
end
`
        }
    ];

    public async insertPattern() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const items = this.patterns.map(p => ({
            label: p.name,
            description: p.category,
            detail: p.description,
            pattern: p
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a pattern to insert'
        });

        if (selected) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, selected.pattern.code.trim());
            });
        }
    }
}
