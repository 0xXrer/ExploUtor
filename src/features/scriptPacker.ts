import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface PackOptions {
    minify?: boolean;
    obfuscate?: boolean;
    outputPath?: string;
    includeComments?: boolean;
}

export class ScriptPacker {
    private outputChannel: any;

    constructor(outputChannel: any) {
        this.outputChannel = outputChannel;
    }

    public async packScripts(): Promise<void> {
        // Select multiple files to pack
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            filters: {
                'Luau Scripts': ['luau', 'lua']
            },
            title: 'Select scripts to pack'
        });

        if (!files || files.length === 0) {
            return;
        }

        // Get pack options
        const minify = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Minify the packed script?'
        });

        if (!minify) {
            return;
        }

        const includeComments = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Include file comments in packed script?'
        });

        if (!includeComments) {
            return;
        }

        // Get output location
        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(
                path.dirname(files[0].fsPath),
                'packed_script.luau'
            )),
            filters: {
                'Luau Script': ['luau'],
                'Lua Script': ['lua']
            },
            title: 'Save packed script as'
        });

        if (!outputUri) {
            return;
        }

        const options: PackOptions = {
            minify: minify === 'Yes',
            includeComments: includeComments === 'Yes',
            outputPath: outputUri.fsPath
        };

        await this.pack(files.map(f => f.fsPath), options);
    }

    private async pack(files: string[], options: PackOptions): Promise<void> {
        try {
            this.outputChannel.info('Packing scripts...');

            const parts: string[] = [];

            // Add header
            parts.push('-- Packed Script');
            parts.push(`-- Generated: ${new Date().toLocaleString()}`);
            parts.push(`-- Files: ${files.length}`);
            parts.push('-- ═══════════════════════════════════════════════════════════');
            parts.push('');

            // Create module loader system
            parts.push('local Modules = {}');
            parts.push('local LoadedModules = {}');
            parts.push('');
            parts.push('local function require(name)');
            parts.push('    if LoadedModules[name] then');
            parts.push('        return LoadedModules[name]');
            parts.push('    end');
            parts.push('    ');
            parts.push('    local module = Modules[name]');
            parts.push('    if not module then');
            parts.push('        error("Module not found: " .. tostring(name))');
            parts.push('    end');
            parts.push('    ');
            parts.push('    local result = module()');
            parts.push('    LoadedModules[name] = result');
            parts.push('    return result');
            parts.push('end');
            parts.push('');

            // Add each file as a module
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i];
                const fileName = path.basename(filePath, path.extname(filePath));
                const content = fs.readFileSync(filePath, 'utf-8');

                if (options.includeComments) {
                    parts.push(`-- ─────────────────────────────────────────────────────────────`);
                    parts.push(`-- Module: ${fileName}`);
                    parts.push(`-- Source: ${path.basename(filePath)}`);
                    parts.push(`-- ─────────────────────────────────────────────────────────────`);
                }

                parts.push(`Modules["${fileName}"] = function()`);

                // Process content
                let processedContent = content;

                if (options.minify) {
                    processedContent = this.minify(processedContent);
                }

                // Indent the content
                const indentedContent = processedContent
                    .split('\n')
                    .map(line => line.trim() ? '    ' + line : '')
                    .join('\n');

                parts.push(indentedContent);
                parts.push('end');
                parts.push('');
            }

            // Add main entry point
            if (options.includeComments) {
                parts.push('-- ─────────────────────────────────────────────────────────────');
                parts.push('-- Main Entry Point');
                parts.push('-- ─────────────────────────────────────────────────────────────');
            }

            parts.push('-- Load main module');
            parts.push(`local main = require("${path.basename(files[0], path.extname(files[0]))}")`);
            parts.push('');
            parts.push('-- Execute main if it\'s a function');
            parts.push('if type(main) == "function" then');
            parts.push('    main()');
            parts.push('end');

            const packed = parts.join('\n');

            // Write to output file
            fs.writeFileSync(options.outputPath!, packed, 'utf-8');

            this.outputChannel.success(`Scripts packed successfully: ${options.outputPath}`);
            vscode.window.showInformationMessage(`Packed ${files.length} scripts to ${path.basename(options.outputPath!)}`);

            // Open the packed file
            const doc = await vscode.workspace.openTextDocument(options.outputPath!);
            await vscode.window.showTextDocument(doc);

        } catch (error: any) {
            this.outputChannel.error(`Failed to pack scripts: ${error.message}`);
            vscode.window.showErrorMessage(`Failed to pack scripts: ${error.message}`);
        }
    }

    private minify(code: string): string {
        // Simple minification - remove comments and extra whitespace
        return code
            .split('\n')
            .map(line => {
                // Remove single-line comments (but keep strings)
                let inString = false;
                let stringChar = '';
                let result = '';

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const next = line[i + 1];

                    if (!inString && (char === '"' || char === "'")) {
                        inString = true;
                        stringChar = char;
                        result += char;
                    } else if (inString && char === stringChar && line[i - 1] !== '\\') {
                        inString = false;
                        result += char;
                    } else if (!inString && char === '-' && next === '-') {
                        break; // Rest is comment
                    } else {
                        result += char;
                    }
                }

                return result.trim();
            })
            .filter(line => line.length > 0)
            .join('\n');
    }

    public async packCurrentWorkspace(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Find all Luau/Lua files in workspace
        const files = await vscode.workspace.findFiles(
            '**/*.{luau,lua}',
            '**/node_modules/**'
        );

        if (files.length === 0) {
            vscode.window.showWarningMessage('No Luau/Lua files found in workspace');
            return;
        }

        const selected = await vscode.window.showQuickPick(
            files.map(f => ({
                label: path.basename(f.fsPath),
                description: vscode.workspace.asRelativePath(f.fsPath),
                uri: f
            })),
            {
                canPickMany: true,
                placeHolder: 'Select files to pack'
            }
        );

        if (!selected || selected.length === 0) {
            return;
        }

        const minify = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Minify the packed script?'
        });

        if (!minify) {
            return;
        }

        const outputUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(
                workspaceFolder.uri.fsPath,
                'packed_script.luau'
            )),
            filters: {
                'Luau Script': ['luau'],
                'Lua Script': ['lua']
            }
        });

        if (!outputUri) {
            return;
        }

        await this.pack(
            selected.map(s => s.uri.fsPath),
            {
                minify: minify === 'Yes',
                includeComments: true,
                outputPath: outputUri.fsPath
            }
        );
    }
}
