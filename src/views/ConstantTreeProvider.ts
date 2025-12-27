import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface ConstantResult {
    value: string;
    type: string;
    index: number;
    closureName: string;
    closureLocation: string;
}

class ConstantItem extends vscode.TreeItem {
    constructor(public readonly constant: ConstantResult) {
        super(constant.value, vscode.TreeItemCollapsibleState.None);
        this.description = `${constant.type} @ ${constant.closureName}`;
        this.tooltip = `Value: ${constant.value}\nType: ${constant.type}\nIndex: ${constant.index}\nClosure: ${constant.closureName}`;
        this.iconPath = new vscode.ThemeIcon('symbol-constant');
    }
}

export class ConstantTreeProvider implements vscode.TreeDataProvider<ConstantItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: ConstantItem[] = [];
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
            const result = await this.rpc.request<{ constants: ConstantResult[] }>('search_constants', { query });
            this.items = (result.constants || []).map(c => new ConstantItem(c));
        } catch { this.items = []; }
        this._onDidChangeTreeData.fire();
    }

    async refresh(): Promise<void> {
        if (this.lastQuery) await this.search(this.lastQuery);
    }

    getTreeItem(el: ConstantItem) { return el; }
    getChildren() { return this.items; }
}
