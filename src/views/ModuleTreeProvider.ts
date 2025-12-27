import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { ModuleInfo, ScanModulesResult } from '../types/protocol';

export class ModuleTreeItem extends vscode.TreeItem {
    constructor(
        public readonly module: ModuleInfo
    ) {
        super(module.name, vscode.TreeItemCollapsibleState.None);
        this.description = `→ ${module.returnType}`;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**Return:** \`${module.returnValue}\`\n\n`);
        this.tooltip.appendCodeblock(module.source.substring(0, 500), 'lua');
        this.contextValue = 'module';
        this.iconPath = new vscode.ThemeIcon('package');
        this.command = {
            command: 'exploitor.inspectItem',
            title: 'Inspect',
            arguments: [{ type: 'module', data: module }]
        };
    }
}

export class ModuleTreeProvider implements vscode.TreeDataProvider<ModuleTreeItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ModuleTreeItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private modules: ModuleInfo[] = [];
    private rpc: JsonRpcHandler;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public async refresh(): Promise<void> {
        try {
            const result = await this.rpc.request<ScanModulesResult>('scan_modules');
            this.modules = result.modules || [];
            this.onDidChangeTreeDataEmitter.fire(undefined);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to scan modules: ${error}`);
        }
    }

    getTreeItem(element: ModuleTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModuleTreeItem): vscode.ProviderResult<ModuleTreeItem[]> {
        if (element) {
            return [];
        }
        return this.modules.map(module => new ModuleTreeItem(module));
    }

    public getModules(): ModuleInfo[] {
        return this.modules;
    }
}
