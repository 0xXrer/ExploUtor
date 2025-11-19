import * as vscode from 'vscode';
import { WebSocketManager } from '../core/websocket';

export interface Variable {
    name: string;
    value: string;
    type: string;
}

export interface InspectionResult {
    success: boolean;
    variables?: Variable[];
    error?: string;
}

export class VariableInspector {
    private inspectorPanel: vscode.WebviewPanel | undefined;
    private wsManager: WebSocketManager;
    private outputChannel: any;

    constructor(wsManager: WebSocketManager, outputChannel: any) {
        this.wsManager = wsManager;
        this.outputChannel = outputChannel;
    }

    public async inspectVariables(): Promise<void> {
        if (this.wsManager.status !== 'connected') {
            vscode.window.showErrorMessage('Not connected to executor. Please connect first.');
            return;
        }

        // Create or show inspector panel
        if (this.inspectorPanel) {
            this.inspectorPanel.reveal();
        } else {
            this.inspectorPanel = vscode.window.createWebviewPanel(
                'variableInspector',
                'Variable Inspector',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.inspectorPanel.onDidDispose(() => {
                this.inspectorPanel = undefined;
            });

            // Handle messages from webview
            this.inspectorPanel.webview.onDidReceiveMessage(
                message => {
                    switch (message.command) {
                        case 'refresh':
                            this.refreshVariables();
                            break;
                        case 'inspect':
                            this.inspectVariable(message.name);
                            break;
                    }
                }
            );
        }

        // Load initial data
        await this.refreshVariables();
    }

    private async refreshVariables(): Promise<void> {
        try {
            this.outputChannel.info('[Variable Inspector] Fetching variables...');

            // Send inspection command to executor
            const inspectionCode = this.generateInspectionCode();

            // Execute the inspection code
            const message: any = {
                type: 'execute' as const,
                code: inspectionCode
            };

            this.wsManager.send(message);

            // Wait for response
            const response: any = await this.waitForResponse();

            if (response.success && response.output) {
                const variables = this.parseVariables(response.output);
                this.updateWebview(variables);
                this.outputChannel.success(`[Variable Inspector] Found ${variables.length} variables`);
            } else {
                this.outputChannel.error(`[Variable Inspector] Failed: ${response.error}`);
                vscode.window.showErrorMessage('Failed to inspect variables');
            }
        } catch (error: any) {
            this.outputChannel.error(`[Variable Inspector] Error: ${error.message}`);
            vscode.window.showErrorMessage(`Variable inspection failed: ${error.message}`);
        }
    }

    private generateInspectionCode(): string {
        return `
-- Variable Inspector
local function serializeValue(value, depth)
    depth = depth or 0
    if depth > 3 then return "..." end

    local t = type(value)

    if t == "nil" then return "nil"
    elseif t == "boolean" then return tostring(value)
    elseif t == "number" then return tostring(value)
    elseif t == "string" then return string.format("%q", value)
    elseif t == "function" then return "function"
    elseif t == "thread" then return "thread"
    elseif t == "userdata" then
        local mt = getmetatable(value)
        if mt and mt.__tostring then
            return tostring(value)
        end
        return "userdata"
    elseif t == "table" then
        local items = {}
        local count = 0
        for k, v in pairs(value) do
            count = count + 1
            if count > 10 then
                table.insert(items, "...")
                break
            end
            local key = type(k) == "string" and k or "[" .. tostring(k) .. "]"
            table.insert(items, key .. " = " .. serializeValue(v, depth + 1))
        end
        return "{" .. table.concat(items, ", ") .. "}"
    else
        return tostring(value)
    end
end

local function inspectGlobals()
    local results = {}
    local env = getgenv and getgenv() or _G

    for name, value in pairs(env) do
        -- Skip internal values
        if not name:match("^_") then
            table.insert(results, {
                name = tostring(name),
                value = serializeValue(value),
                type = type(value)
            })
        end
    end

    return results
end

local globals = inspectGlobals()
local output = "EXPLOITOR_INSPECTOR_START\\n"

for _, var in ipairs(globals) do
    output = output .. string.format("%s|%s|%s\\n", var.name, var.type, var.value)
end

output = output .. "EXPLOITOR_INSPECTOR_END"
print(output)
`;
    }

    private parseVariables(output: string): Variable[] {
        const variables: Variable[] = [];

        const startMarker = 'EXPLOITOR_INSPECTOR_START';
        const endMarker = 'EXPLOITOR_INSPECTOR_END';

        const startIdx = output.indexOf(startMarker);
        const endIdx = output.indexOf(endMarker);

        if (startIdx === -1 || endIdx === -1) {
            return variables;
        }

        const data = output.substring(startIdx + startMarker.length, endIdx).trim();
        const lines = data.split('\n');

        for (const line of lines) {
            if (!line.trim()) continue;

            const parts = line.split('|');
            if (parts.length >= 3) {
                variables.push({
                    name: parts[0],
                    type: parts[1],
                    value: parts.slice(2).join('|')
                });
            }
        }

        return variables;
    }

    private updateWebview(variables: Variable[]): void {
        if (!this.inspectorPanel) {
            return;
        }

        this.inspectorPanel.webview.html = this.generateWebviewContent(variables);
    }

    private generateWebviewContent(variables: Variable[]): string {
        const variableRows = variables
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(v => `
                <tr>
                    <td class="name">${this.escapeHtml(v.name)}</td>
                    <td class="type">${this.escapeHtml(v.type)}</td>
                    <td class="value">${this.escapeHtml(v.value)}</td>
                </tr>
            `)
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Variable Inspector</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h2 {
            margin: 0;
            color: var(--vscode-foreground);
        }

        .header button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
        }

        .header button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .stats {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9em;
        }

        th {
            background-color: var(--vscode-editor-lineHighlightBackground);
            color: var(--vscode-foreground);
            padding: 8px;
            text-align: left;
            font-weight: 600;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        td {
            padding: 6px 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        tr:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .name {
            color: var(--vscode-symbolIcon-variableForeground);
            font-weight: 500;
        }

        .type {
            color: var(--vscode-symbolIcon-keywordForeground);
            font-style: italic;
        }

        .value {
            color: var(--vscode-symbolIcon-stringForeground);
            font-family: var(--vscode-editor-font-family);
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .empty {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>🔍 Variable Inspector</h2>
        <button onclick="refresh()">🔄 Refresh</button>
    </div>

    <div class="stats">
        Found ${variables.length} global variables
    </div>

    ${variables.length > 0 ? `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${variableRows}
            </tbody>
        </table>
    ` : `
        <div class="empty">
            <p>No variables found</p>
            <p>Make sure your executor is connected and running</p>
        </div>
    `}

    <script>
        const vscode = acquireVsCodeApi();

        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }

        function inspectVariable(name) {
            vscode.postMessage({ command: 'inspect', name: name });
        }
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    private async inspectVariable(name: string): Promise<void> {
        // TODO: Implement detailed variable inspection
        this.outputChannel.info(`[Variable Inspector] Inspecting: ${name}`);
    }

    private waitForResponse(timeout: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Response timeout'));
            }, timeout);

            const disposable = this.wsManager.onMessage((message: any) => {
                clearTimeout(timer);
                disposable.dispose();
                resolve(message);
            });
        });
    }

    public dispose(): void {
        if (this.inspectorPanel) {
            this.inspectorPanel.dispose();
            this.inspectorPanel = undefined;
        }
    }
}
