import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface ModuleResult {
    name: string;
    className: string;
    path: string;
}

class ModuleItem extends vscode.TreeItem {
    constructor(public readonly module: ModuleResult) {
        super(module.name, vscode.TreeItemCollapsibleState.None);
        this.description = 'ModuleScript';
        this.tooltip = module.path;
        this.iconPath = new vscode.ThemeIcon('package');
        this.command = { command: 'exploitor.readScript', title: 'Read', arguments: [module.path] };
    }
}

export class ModuleTreeProvider implements vscode.TreeDataProvider<ModuleItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: ModuleItem[] = [];
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
            const result = await this.rpc.request<{ scripts: ModuleResult[] }>('search_scripts', { query, includeModules: true });
            this.items = (result.scripts || []).filter(s => s.className === 'ModuleScript').map(m => new ModuleItem(m));
        } catch { this.items = []; }
        this._onDidChangeTreeData.fire();
    }

    async refresh(): Promise<void> {
        if (this.lastQuery) await this.search(this.lastQuery);
    }

    getTreeItem(el: ModuleItem) { return el; }
    getChildren() { return this.items; }
}
