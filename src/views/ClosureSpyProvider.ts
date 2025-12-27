import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { ClosureCallInfo } from '../types/protocol';

export class ClosureCallItem extends vscode.TreeItem {
    constructor(
        public readonly call: ClosureCallInfo
    ) {
        const time = new Date(call.timestamp).toLocaleTimeString();
        super(`${time} - ${call.closureName}`, vscode.TreeItemCollapsibleState.None);
        this.description = call.closureLocation;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**Closure:** ${call.closureName}\n\n`);
        this.tooltip.appendMarkdown(`**Location:** ${call.closureLocation}\n\n`);
        this.tooltip.appendMarkdown(`**Arguments:**\n\`\`\`lua\n${call.arguments}\n\`\`\`\n\n`);
        this.tooltip.appendMarkdown(`**Traceback:**\n\`\`\`\n${call.traceback}\n\`\`\``);
        this.iconPath = new vscode.ThemeIcon('symbol-function');
    }
}

export class ClosureSpyProvider implements vscode.TreeDataProvider<ClosureCallItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ClosureCallItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private calls: ClosureCallInfo[] = [];
    private maxCalls = 500;
    private enabled = false;
    private rpc: JsonRpcHandler;
    private disposable: vscode.Disposable | null = null;
    private filterPattern: string | null = null;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public enable(): void {
        if (this.enabled) return;
        
        this.enabled = true;
        this.rpc.notify('enable_closure_spy', { enabled: true });
        
        this.disposable = this.rpc.onNotification('closure_called', (params) => {
            this.addCall(params as ClosureCallInfo);
        });
    }

    public disable(): void {
        if (!this.enabled) return;
        
        this.enabled = false;
        this.rpc.notify('enable_closure_spy', { enabled: false });
        
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = null;
        }
    }

    public toggle(): void {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        vscode.window.showInformationMessage(`Closure Spy: ${this.enabled ? 'Enabled' : 'Disabled'}`);
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setFilter(pattern: string | null): void {
        this.filterPattern = pattern;
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    private addCall(call: ClosureCallInfo): void {
        if (this.filterPattern && !call.closureName.includes(this.filterPattern)) {
            return;
        }
        
        this.calls.unshift(call);
        if (this.calls.length > this.maxCalls) {
            this.calls.pop();
        }
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    public clear(): void {
        this.calls = [];
        this.onDidChangeTreeDataEmitter.fire(undefined);
    }

    getTreeItem(element: ClosureCallItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ClosureCallItem): vscode.ProviderResult<ClosureCallItem[]> {
        if (element) {
            return [];
        }
        return this.calls.map(call => new ClosureCallItem(call));
    }

    public dispose(): void {
        this.disable();
    }
}
