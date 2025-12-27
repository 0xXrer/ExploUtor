import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { ScriptInfo, ScanScriptsResult } from '../types/protocol';

export class ScriptTreeItem extends vscode.TreeItem {
    constructor(
        public readonly script: ScriptInfo
    ) {
        super(script.name, vscode.TreeItemCollapsibleState.None);
        this.description = `P:${script.protosCount} C:${script.constantsCount}`;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendCodeblock(script.source.substring(0, 500), 'lua');
        this.contextValue = 'script';
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.command = {
            command: 'exploitor.inspectItem',
            title: 'Inspect',
            arguments: [{ type: 'script', data: script }]
        };
    }
}

export class ScriptTreeProvider implements vscode.TreeDataProvider<ScriptTreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ScriptTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private scripts: ScriptInfo[] = [];
    private rpc: JsonRpcHandler;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public async refresh(): Promise<void> {
        try {
            const result = await this.rpc.request<ScanScriptsResult>('scan_scripts');
            this.scripts = result.scripts || [];
            this.onDidChangeTreeDataEmitter.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to scan scripts: ${error}`);
        }
    }

    getTreeItem(element: ScriptTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ScriptTreeItem): vscode.ProviderResult<ScriptTreeItem[]> {
        if (element) {
            return [];
        }
        return this.scripts.map(script => new ScriptTreeItem(script));
    }

    public getScripts(): ScriptInfo[] {
        return this.scripts;
    }
}
