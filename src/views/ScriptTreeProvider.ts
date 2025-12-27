import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface ScriptResult {
    name: string;
    className: string;
    path: string;
}

class ScriptItem extends vscode.TreeItem {
    constructor(public readonly script: ScriptResult) {
        super(script.name, vscode.TreeItemCollapsibleState.None);
        this.description = script.className;
        this.tooltip = script.path;
        this.iconPath = new vscode.ThemeIcon('file-code');
        this.command = { command: 'exploitor.readScript', title: 'Read', arguments: [script.path] };
    }
}

export class ScriptTreeProvider implements vscode.TreeDataProvider<ScriptItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: ScriptItem[] = [];
    private rpc = JsonRpcHandler.getInstance();
    private lastQuery = '';

    async search(query: string): Promise<void> {
        if (!query.trim()) {
            this.items = [];
            this._onDidChangeTreeData.fire();
            return;
        }
        this.lastQuery = query;
        try {
            const result = await this.rpc.request<{ scripts: ScriptResult[] }>('search_scripts', { query, includeModules: false });
            this.items = (result.scripts || []).map(s => new ScriptItem(s));
        } catch { this.items = []; }
        this._onDidChangeTreeData.fire();
    }

    async refresh(): Promise<void> {
        if (this.lastQuery) await this.search(this.lastQuery);
    }

    getTreeItem(el: ScriptItem) { return el; }
    getChildren() { return this.items; }
}
