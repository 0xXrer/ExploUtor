import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { ConstantInfo, ScanConstantsResult } from '../types/protocol';

interface TypeGroup {
    type: string;
    constants: ConstantInfo[];
}

export class ConstantTreeItem extends vscode.TreeItem {
    constructor(
        public readonly constant: ConstantInfo
    ) {
        super(constant.value, vscode.TreeItemCollapsibleState.None);
        this.description = constant.closureName;
        this.tooltip = `Value: ${constant.value}\nType: ${constant.type}\nClosure: ${constant.closureName}\nLocation: ${constant.closureLocation}`;
        this.contextValue = 'constant';
        this.iconPath = this.getIcon(constant.type);
        this.command = {
            command: 'exploitor.inspectItem',
            title: 'Inspect',
            arguments: [{ type: 'constant', data: constant }]
        };
    }

    private getIcon(type: string): vscode.ThemeIcon {
        switch (type) {
            case 'string': return new vscode.ThemeIcon('symbol-string');
            case 'number': return new vscode.ThemeIcon('symbol-number');
            case 'boolean': return new vscode.ThemeIcon('symbol-boolean');
            default: return new vscode.ThemeIcon('symbol-constant');
        }
    }
}

export class TypeGroupItem extends vscode.TreeItem {
    constructor(
        public readonly group: TypeGroup
    ) {
        super(group.type, vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${group.constants.length} constants`;
        this.iconPath = new vscode.ThemeIcon('symbol-type-parameter');
    }
}

export class ConstantTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private constants: ConstantInfo[] = [];
    private typeGroups: TypeGroup[] = [];
    private rpc: JsonRpcHandler;
    private filterType: string | null = null;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public async refresh(): Promise<void> {
        try {
            const result = await this.rpc.request<ScanConstantsResult>('scan_constants');
            this.constants = result.constants || [];
            this.buildTypeGroups();
            this.onDidChangeTreeDataEmitter.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to scan constants: ${error}`);
        }
    }

    public setFilter(type: string | null): void {
        this.filterType = type;
        this.buildTypeGroups();
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    private buildTypeGroups(): void {
        const filtered = this.filterType 
            ? this.constants.filter(c => c.type === this.filterType)
            : this.constants;

        const groups = new Map<string, TypeGroup>();
        
        for (const constant of filtered) {
            let group = groups.get(constant.type);
            if (!group) {
                group = { type: constant.type, constants: [] };
                groups.set(constant.type, group);
            }
            group.constants.push(constant);
        }
        
        this.typeGroups = Array.from(groups.values());
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return this.typeGroups.map(group => new TypeGroupItem(group));
        }
        
        if (element instanceof TypeGroupItem) {
            return element.group.constants.map(constant => new ConstantTreeItem(constant));
        }
        
        return [];
    }

    public getConstants(): ConstantInfo[] {
        return this.constants;
    }
}
