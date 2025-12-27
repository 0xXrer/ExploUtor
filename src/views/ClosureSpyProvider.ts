import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface ClosureResult {
    name: string;
    location: string;
}

class ClosureItem extends vscode.TreeItem {
    constructor(public readonly closure: ClosureResult) {
        super(closure.name, vscode.TreeItemCollapsibleState.None);
        this.description = closure.location;
        this.tooltip = `${closure.name}\n${closure.location}`;
        this.iconPath = new vscode.ThemeIcon('symbol-function');
    }
}

export class ClosureSpyProvider implements vscode.TreeDataProvider<ClosureItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: ClosureItem[] = [];
    private rpc = JsonRpcHandler.getInstance();
    private lastQuery = '';

    async search(query: string, searchConstants = false): Promise<void> {
        if (!query.trim()) {
            this.items = [];
            this._onDidChangeTreeData.fire();
            return;
        }
        this.lastQuery = query;
        try {
            const result = await this.rpc.request<{ closures: ClosureResult[] }>('search_closures', { query, searchConstants });
            this.items = (result.closures || []).map(c => new ClosureItem(c));
        } catch { this.items = []; }
        this._onDidChangeTreeData.fire();
    }

    clear(): void {
        this.items = [];
        this.lastQuery = '';
        this._onDidChangeTreeData.fire();
    }

    async refresh(): Promise<void> {
        if (this.lastQuery) await this.search(this.lastQuery);
    }

    getTreeItem(el: ClosureItem) { return el; }
    getChildren() { return this.items; }
    
    dispose(): void {}
}
