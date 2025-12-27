import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { UpvalueInfo, ScanUpvaluesResult } from '../types/protocol';

interface ClosureGroup {
    closureId: string;
    closureName: string;
    closureLocation: string;
    upvalues: UpvalueInfo[];
}

export class UpvalueTreeItem extends vscode.TreeItem {
    constructor(
        public readonly upvalue: UpvalueInfo,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(`${upvalue.name}: ${upvalue.value}`, collapsibleState);
        this.description = upvalue.type;
        this.tooltip = `${upvalue.name} (${upvalue.type})\nValue: ${upvalue.value}\nClosure: ${upvalue.closureName}`;
        this.contextValue = 'upvalue';
        this.iconPath = this.getIcon(upvalue.type);
        this.command = {
            command: 'exploitor.inspectItem',
            title: 'Inspect',
            arguments: [{ type: 'upvalue', data: upvalue }]
        };
    }

    private getIcon(type: string): vscode.ThemeIcon {
        switch (type) {
            case 'string': return new vscode.ThemeIcon('symbol-string');
            case 'number': return new vscode.ThemeIcon('symbol-number');
            case 'boolean': return new vscode.ThemeIcon('symbol-boolean');
            case 'function': return new vscode.ThemeIcon('symbol-function');
            case 'table': return new vscode.ThemeIcon('symbol-object');
            default: return new vscode.ThemeIcon('symbol-variable');
        }
    }
}

export class ClosureGroupItem extends vscode.TreeItem {
    constructor(
        public readonly group: ClosureGroup
    ) {
        super(group.closureName || 'Anonymous', vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${group.upvalues.length} upvalues`;
        this.tooltip = group.closureLocation;
        this.iconPath = new vscode.ThemeIcon('symbol-method');
    }
}

export class UpvalueTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private upvalues: UpvalueInfo[] = [];
    private closureGroups: ClosureGroup[] = [];
    private rpc: JsonRpcHandler;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public async refresh(): Promise<void> {
        try {
            const result = await this.rpc.request<ScanUpvaluesResult>('scan_upvalues');
            this.upvalues = result.upvalues || [];
            this.buildClosureGroups();
            this.onDidChangeTreeDataEmitter.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to scan upvalues: ${error}`);
        }
    }

    private buildClosureGroups(): void {
        const groups = new Map<string, ClosureGroup>();
        
        for (const upvalue of this.upvalues) {
            let group = groups.get(upvalue.closureId);
            if (!group) {
                group = {
                    closureId: upvalue.closureId,
                    closureName: upvalue.closureName,
                    closureLocation: upvalue.closureLocation,
                    upvalues: []
                };
                groups.set(upvalue.closureId, group);
            }
            group.upvalues.push(upvalue);
        }
        
        this.closureGroups = Array.from(groups.values());
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this.closureGroups.map(group => new ClosureGroupItem(group));
        }
        
        if (element instanceof ClosureGroupItem) {
            return element.group.upvalues.map(
                upvalue => new UpvalueTreeItem(upvalue, vscode.TreeItemCollapsibleState.None)
            );
        }
        
        return [];
    }

    public getUpvalues(): UpvalueInfo[] {
        return this.upvalues;
    }
}
