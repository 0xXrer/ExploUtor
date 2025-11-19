import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ObfuscationOptions {
    renameVariables?: boolean;
    removeComments?: boolean;
    removeWhitespace?: boolean;
    stringEncoding?: 'none' | 'base64' | 'hex';
}

export class Obfuscator {
    private outputChannel: any;

    constructor(outputChannel: any) {
        this.outputChannel = outputChannel;
    }

    public async obfuscateScript(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        if (editor.document.languageId !== 'luau' && editor.document.languageId !== 'lua') {
            vscode.window.showErrorMessage('Current file is not a Luau/Lua script');
            return;
        }

        // Get obfuscation options
        const renameVars = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Rename variables?'
        });

        if (!renameVars) {
            return;
        }

        const removeComments = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Remove comments?'
        });

        if (!removeComments) {
            return;
        }

        const encoding = await vscode.window.showQuickPick(['None', 'Base64', 'Hex'], {
            placeHolder: 'String encoding?'
        });

        if (!encoding) {
            return;
        }

        const options: ObfuscationOptions = {
            renameVariables: renameVars === 'Yes',
            removeComments: removeComments === 'Yes',
            removeWhitespace: true,
            stringEncoding: encoding.toLowerCase() as any
        };

        const code = editor.document.getText();
        const obfuscated = this.obfuscate(code, options);

        // Create new document with obfuscated code
        const fileName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
        const newFileName = `${fileName}_obfuscated${path.extname(editor.document.fileName)}`;
        const newFilePath = path.join(path.dirname(editor.document.fileName), newFileName);

        fs.writeFileSync(newFilePath, obfuscated, 'utf-8');

        const doc = await vscode.workspace.openTextDocument(newFilePath);
        await vscode.window.showTextDocument(doc);

        this.outputChannel.success(`Script obfuscated: ${newFileName}`);
        vscode.window.showInformationMessage(`Script obfuscated and saved as ${newFileName}`);
    }

    private obfuscate(code: string, options: ObfuscationOptions): string {
        let result = code;

        // Remove comments
        if (options.removeComments) {
            result = this.removeComments(result);
        }

        // Encode strings
        if (options.stringEncoding && options.stringEncoding !== 'none') {
            result = this.encodeStrings(result, options.stringEncoding);
        }

        // Rename variables (basic implementation)
        if (options.renameVariables) {
            result = this.renameVariables(result);
        }

        // Remove extra whitespace
        if (options.removeWhitespace) {
            result = this.removeWhitespace(result);
        }

        return result;
    }

    private removeComments(code: string): string {
        const lines = code.split('\n');
        const result: string[] = [];

        for (const line of lines) {
            let inString = false;
            let stringChar = '';
            let cleaned = '';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const next = line[i + 1];
                const prev = line[i - 1];

                if (!inString && (char === '"' || char === "'")) {
                    inString = true;
                    stringChar = char;
                    cleaned += char;
                } else if (inString && char === stringChar && prev !== '\\') {
                    inString = false;
                    cleaned += char;
                } else if (!inString && char === '-' && next === '-') {
                    break; // Rest is comment
                } else {
                    cleaned += char;
                }
            }

            if (cleaned.trim()) {
                result.push(cleaned);
            }
        }

        return result.join('\n');
    }

    private encodeStrings(code: string, encoding: 'base64' | 'hex'): string {
        const stringPattern = /(["'])((?:\\.|(?!\1).)*?)\1/g;

        return code.replace(stringPattern, (match, quote, content) => {
            // Don't encode empty strings or very short strings
            if (content.length < 3) {
                return match;
            }

            let encoded: string;
            let decodeFn: string;

            if (encoding === 'base64') {
                encoded = Buffer.from(content).toString('base64');
                decodeFn = `(function(s) local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' local d='' local p=0 for c in s:gmatch'.' do local n=b:find(c)-1 if n then d=d..string.char(n) p=p+1 end end return (d:gsub('....',function(x)return string.char(tonumber(x:byte(1)*4+x:byte(2)/16)..tonumber(x:byte(2)%16*16+x:byte(3)/4)..tonumber(x:byte(3)%4*64+x:byte(4)))end):gsub('%z+$',''))end)("${encoded}")`;
            } else {
                // Hex encoding
                encoded = Buffer.from(content).toString('hex');
                decodeFn = `(function(h)return(h:gsub('..',function(x)return string.char(tonumber(x,16))end))end)("${encoded}")`;
            }

            return decodeFn;
        });
    }

    private renameVariables(code: string): string {
        // Simple variable renaming - finds 'local' declarations
        const localPattern = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
        const variables: Map<string, string> = new Map();
        let counter = 0;

        // Don't rename common/important variables
        const reserved = new Set([
            'game', 'workspace', 'script', 'local', 'function', 'return',
            'if', 'then', 'else', 'elseif', 'end', 'for', 'while', 'repeat',
            'until', 'do', 'break', 'true', 'false', 'nil', 'and', 'or', 'not',
            'self', 'getgenv', 'getrenv', 'getfenv', 'setfenv'
        ]);

        // First pass: collect variables
        let match;
        while ((match = localPattern.exec(code)) !== null) {
            const varName = match[1];
            if (!reserved.has(varName) && !variables.has(varName)) {
                variables.set(varName, `_${this.generateVarName(counter++)}`);
            }
        }

        // Second pass: rename variables
        let result = code;
        for (const [oldName, newName] of variables.entries()) {
            const pattern = new RegExp(`\\b${oldName}\\b`, 'g');
            result = result.replace(pattern, newName);
        }

        return result;
    }

    private generateVarName(num: number): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let name = '';
        do {
            name = chars[num % chars.length] + name;
            num = Math.floor(num / chars.length);
        } while (num > 0);
        return name || 'a';
    }

    private removeWhitespace(code: string): string {
        return code
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');
    }

    public async obfuscateWithExternalTool(): Promise<void> {
        vscode.window.showInformationMessage(
            'External obfuscators: Ironbrew, Luraph, PSU',
            'Open Ironbrew', 'Open Luraph', 'Open PSU'
        ).then(selection => {
            switch (selection) {
                case 'Open Ironbrew':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/Sn0wl1/Ironbrew'));
                    break;
                case 'Open Luraph':
                    vscode.env.openExternal(vscode.Uri.parse('https://luraph.com/'));
                    break;
                case 'Open PSU':
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/zzerexx/psu-obfuscator'));
                    break;
            }
        });
    }
}
