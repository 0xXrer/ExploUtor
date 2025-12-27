import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { 
    InspectorItem, 
    ModifyUpvalueParams,
    UpvalueInfo,
    ConstantInfo,
    ScriptInfo,
    ModuleInfo,
    ClosureInfo
} from '../types/protocol';

export class InspectorPanel {
    public static currentPanel: InspectorPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private currentItem: InspectorItem | null = null;
    private rpc: JsonRpcHandler;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.rpc = JsonRpcHandler.getInstance();

        this.panel.webview.onDidReceiveMessage(
            this.handleMessage.bind(this),
            null,
            this.disposables
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static createOrShow(extensionUri: vscode.Uri, item: InspectorItem): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (InspectorPanel.currentPanel) {
            InspectorPanel.currentPanel.panel.reveal(column);
            InspectorPanel.currentPanel.update(item);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'exploitorInspector',
            'ExploUtor Inspector',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        InspectorPanel.currentPanel = new InspectorPanel(panel, extensionUri);
        InspectorPanel.currentPanel.update(item);
    }

    public update(item: InspectorItem): void {
        this.currentItem = item;
        this.panel.title = this.getTitle(item);
        this.panel.webview.html = this.getHtml(item);
    }

    private getTitle(item: InspectorItem): string {
        switch (item.type) {
            case 'upvalue': return `Upvalue: ${item.data.name}`;
            case 'constant': return `Constant: ${item.data.value.substring(0, 20)}`;
            case 'script': return `Script: ${item.data.name}`;
            case 'module': return `Module: ${item.data.name}`;
            case 'closure': return `Closure: ${item.data.name}`;
        }
    }

    private async handleMessage(message: { command: string; value?: string; valueType?: string }): Promise<void> {
        switch (message.command) {
            case 'modifyUpvalue':
                if (this.currentItem?.type === 'upvalue' && message.value !== undefined) {
                    await this.modifyUpvalue(message.value, message.valueType || 'string');
                }
                break;
            case 'copyToClipboard':
                if (message.value) {
                    await vscode.env.clipboard.writeText(message.value);
                    vscode.window.showInformationMessage('Copied to clipboard');
                }
                break;
        }
    }

    private async modifyUpvalue(value: string, valueType: string): Promise<void> {
        if (this.currentItem?.type !== 'upvalue') return;

        const upvalueData = this.currentItem.data;
        const params: ModifyUpvalueParams = {
            closureId: upvalueData.closureId,
            upvalueIndex: upvalueData.index,
            value,
            valueType
        };

        try {
            await this.rpc.request('modify_upvalue', params);
            vscode.window.showInformationMessage('Upvalue modified successfully');
            
            upvalueData.value = value;
            upvalueData.type = valueType;
            this.update(this.currentItem);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to modify upvalue: ${error}`);
        }
    }

    private getHtml(item: InspectorItem): string {
        const styles = this.getStyles();
        const content = this.getContent(item);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>ExploUtor Inspector</title>
    <style>${styles}</style>
</head>
<body>
    ${content}
    <script>${this.getScript()}</script>
</body>
</html>`;
    }

    private getStyles(): string {
        return `
            :root {
                --vscode-font-family: var(--vscode-editor-font-family, 'Segoe UI', Tahoma, sans-serif);
                --vscode-font-size: var(--vscode-editor-font-size, 13px);
            }
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                padding: 16px;
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
            }
            h1 { font-size: 1.4em; margin-bottom: 16px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 8px; }
            h2 { font-size: 1.1em; margin-top: 16px; margin-bottom: 8px; color: var(--vscode-descriptionForeground); }
            .property { display: flex; margin-bottom: 8px; }
            .property-name { font-weight: bold; min-width: 120px; color: var(--vscode-symbolIcon-propertyForeground); }
            .property-value { color: var(--vscode-symbolIcon-stringForeground); word-break: break-all; }
            .code-block {
                background: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: 12px;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                overflow-x: auto;
                white-space: pre-wrap;
                max-height: 400px;
                overflow-y: auto;
            }
            .btn {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 14px;
                border-radius: 2px;
                cursor: pointer;
                margin-right: 8px;
                margin-top: 8px;
            }
            .btn:hover { background: var(--vscode-button-hoverBackground); }
            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }
            input, select {
                padding: 4px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                margin-right: 8px;
            }
            .edit-section { margin-top: 16px; padding: 12px; background: var(--vscode-sideBar-background); border-radius: 4px; }
            .type-string { color: #ce9178; }
            .type-number { color: #b5cea8; }
            .type-boolean { color: #569cd6; }
            .type-function { color: #dcdcaa; }
            .type-table { color: #4ec9b0; }
        `;
    }

    private getContent(item: InspectorItem): string {
        switch (item.type) {
            case 'upvalue': return this.getUpvalueContent(item.data);
            case 'constant': return this.getConstantContent(item.data);
            case 'script': return this.getScriptContent(item.data);
            case 'module': return this.getModuleContent(item.data);
            case 'closure': return this.getClosureContent(item.data);
        }
    }

    private getUpvalueContent(data: UpvalueInfo): string {
        return `
            <h1>Upvalue Inspector</h1>
            <div class="property"><span class="property-name">Name:</span><span class="property-value">${this.escapeHtml(data.name)}</span></div>
            <div class="property"><span class="property-name">Type:</span><span class="property-value type-${data.type}">${data.type}</span></div>
            <div class="property"><span class="property-name">Index:</span><span class="property-value">${data.index}</span></div>
            <div class="property"><span class="property-name">Value:</span><span class="property-value">${this.escapeHtml(data.value)}</span></div>
            <h2>Closure Info</h2>
            <div class="property"><span class="property-name">Closure:</span><span class="property-value">${this.escapeHtml(data.closureName)}</span></div>
            <div class="property"><span class="property-name">Location:</span><span class="property-value">${this.escapeHtml(data.closureLocation)}</span></div>
            <div class="edit-section">
                <h2>Edit Value</h2>
                <select id="valueType">
                    <option value="string" ${data.type === 'string' ? 'selected' : ''}>string</option>
                    <option value="number" ${data.type === 'number' ? 'selected' : ''}>number</option>
                    <option value="boolean" ${data.type === 'boolean' ? 'selected' : ''}>boolean</option>
                    <option value="nil" ${data.type === 'nil' ? 'selected' : ''}>nil</option>
                </select>
                <input type="text" id="newValue" value="${this.escapeHtml(data.value)}" style="width: 300px;" />
                <button class="btn" onclick="modifyUpvalue()">Apply</button>
            </div>
            <button class="btn btn-secondary" onclick="copyValue('${this.escapeHtml(data.value)}')">Copy Value</button>
        `;
    }

    private getConstantContent(data: ConstantInfo): string {
        return `
            <h1>Constant Inspector</h1>
            <div class="property"><span class="property-name">Type:</span><span class="property-value type-${data.type}">${data.type}</span></div>
            <div class="property"><span class="property-name">Index:</span><span class="property-value">${data.index}</span></div>
            <div class="property"><span class="property-name">Value:</span></div>
            <div class="code-block">${this.escapeHtml(data.value)}</div>
            <h2>Closure Info</h2>
            <div class="property"><span class="property-name">Closure:</span><span class="property-value">${this.escapeHtml(data.closureName)}</span></div>
            <div class="property"><span class="property-name">Location:</span><span class="property-value">${this.escapeHtml(data.closureLocation)}</span></div>
            <button class="btn btn-secondary" onclick="copyValue('${this.escapeHtml(data.value)}')">Copy Value</button>
        `;
    }

    private getScriptContent(data: ScriptInfo): string {
        const escapedSource = this.escapeHtml(data.source).replace(/`/g, '\\`');
        return `
            <h1>Script Inspector</h1>
            <div class="property"><span class="property-name">Name:</span><span class="property-value">${this.escapeHtml(data.name)}</span></div>
            <div class="property"><span class="property-name">Path:</span><span class="property-value">${this.escapeHtml(data.path)}</span></div>
            <div class="property"><span class="property-name">Class:</span><span class="property-value">${data.className}</span></div>
            <div class="property"><span class="property-name">Protos:</span><span class="property-value">${data.protosCount}</span></div>
            <div class="property"><span class="property-name">Constants:</span><span class="property-value">${data.constantsCount}</span></div>
            <div class="property"><span class="property-name">Upvalues:</span><span class="property-value">${data.upvaluesCount}</span></div>
            <h2>Source</h2>
            <div class="code-block">${this.escapeHtml(data.source)}</div>
            <button class="btn btn-secondary" onclick="copyValue(\`${escapedSource}\`)">Copy Source</button>
        `;
    }

    private getModuleContent(data: ModuleInfo): string {
        const escapedSource = this.escapeHtml(data.source).replace(/`/g, '\\`');
        return `
            <h1>Module Inspector</h1>
            <div class="property"><span class="property-name">Name:</span><span class="property-value">${this.escapeHtml(data.name)}</span></div>
            <div class="property"><span class="property-name">Path:</span><span class="property-value">${this.escapeHtml(data.path)}</span></div>
            <div class="property"><span class="property-name">Return Type:</span><span class="property-value type-${data.returnType}">${data.returnType}</span></div>
            <div class="property"><span class="property-name">Return Value:</span></div>
            <div class="code-block">${this.escapeHtml(data.returnValue)}</div>
            <h2>Source</h2>
            <div class="code-block">${this.escapeHtml(data.source)}</div>
            <button class="btn btn-secondary" onclick="copyValue(\`${escapedSource}\`)">Copy Source</button>
        `;
    }

    private getClosureContent(data: ClosureInfo): string {
        const upvaluesList = data.upvalues.map(u => 
            `<div class="property"><span class="property-name">${u.name}:</span><span class="property-value type-${u.type}">${this.escapeHtml(u.value)}</span></div>`
        ).join('');

        const constantsList = data.constants.map(c => 
            `<div class="property"><span class="property-name">[${c.index}]:</span><span class="property-value type-${c.type}">${this.escapeHtml(c.value)}</span></div>`
        ).join('');

        return `
            <h1>Closure Inspector</h1>
            <div class="property"><span class="property-name">Name:</span><span class="property-value">${this.escapeHtml(data.name)}</span></div>
            <div class="property"><span class="property-name">Location:</span><span class="property-value">${this.escapeHtml(data.location)}</span></div>
            <div class="property"><span class="property-name">Protos:</span><span class="property-value">${data.protosCount}</span></div>
            <div class="property"><span class="property-name">Constants:</span><span class="property-value">${data.constantsCount}</span></div>
            <div class="property"><span class="property-name">Upvalues:</span><span class="property-value">${data.upvaluesCount}</span></div>
            <h2>Upvalues</h2>
            ${upvaluesList || '<p>No upvalues</p>'}
            <h2>Constants</h2>
            ${constantsList || '<p>No constants</p>'}
            <h2>Source</h2>
            <div class="code-block">${this.escapeHtml(data.source)}</div>
        `;
    }

    private getScript(): string {
        return `
            const vscode = acquireVsCodeApi();
            
            function modifyUpvalue() {
                const value = document.getElementById('newValue').value;
                const valueType = document.getElementById('valueType').value;
                vscode.postMessage({ command: 'modifyUpvalue', value, valueType });
            }
            
            function copyValue(value) {
                vscode.postMessage({ command: 'copyToClipboard', value });
            }
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public dispose(): void {
        InspectorPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
