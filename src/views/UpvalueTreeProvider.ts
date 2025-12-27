import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface UpvalueResult {
    name: string;
    value: string;
    type: string;
    index: number;
    closureName: string;
    closureLocation: string;
}

class UpvalueItem extends vscode.TreeItem {
    constructor(public readonly upvalue: UpvalueResult) {
        super(`${upvalue.name}: ${upvalue.value}`, vscode.TreeItemCollapsibleState.None);
        this.description = `${upvalue.type} @ ${upvalue.closureName}`;
        this.tooltip = `${upvalue.name}\nType: ${upvalue.type}\nValue: ${upvalue.value}\nClosure: ${upvalue.closureName}\nLocation: ${upvalue.closureLocation}`;
        this.contextValue = 'upvalue';
        this.iconPath = new vscode.ThemeIcon('symbol-variable');
    }
}

export class UpvalueTreeProvider implements vscode.TreeDataProvider<UpvalueItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: UpvalueItem[] = [];
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
            const result = await this.rpc.request<{ upvalues: UpvalueResult[] }>('search_upvalues', { query });
            this.items = (result.upvalues || []).map(u => new UpvalueItem(u));
        } catch { this.items = []; }
        this._onDidChangeTreeData.fire();
    }

    async refresh(): Promise<void> {
        if (this.lastQuery) await this.search(this.lastQuery);
    }

    getTreeItem(el: UpvalueItem) { return el; }
    getChildren() { return this.items; }
}
