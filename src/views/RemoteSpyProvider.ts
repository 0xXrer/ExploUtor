import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { RemoteCallInfo } from '../types/protocol';

export class RemoteCallItem extends vscode.TreeItem {
    constructor(
        public readonly call: RemoteCallInfo
    ) {
        const time = new Date(call.timestamp).toLocaleTimeString();
        super(`${time} - ${call.remoteName}`, vscode.TreeItemCollapsibleState.None);
        this.description = call.remoteType;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**Remote:** ${call.remoteName}\n\n`);
        this.tooltip.appendMarkdown(`**Type:** ${call.remoteType}\n\n`);
        this.tooltip.appendMarkdown(`**Arguments:**\n\`\`\`lua\n${call.arguments}\n\`\`\`\n\n`);
        this.tooltip.appendMarkdown(`**Caller:** ${call.caller}\n\n`);
        this.tooltip.appendMarkdown(`**Traceback:**\n\`\`\`\n${call.traceback}\n\`\`\``);
        this.iconPath = call.remoteType === 'RemoteEvent' 
            ? new vscode.ThemeIcon('broadcast') 
            : new vscode.ThemeIcon('call-outgoing');
    }
}

export class RemoteSpyProvider implements vscode.TreeDataProvider<RemoteCallItem> {
    private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<RemoteCallItem | undefined>();
    readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    
    private calls: RemoteCallInfo[] = [];
    private maxCalls = 500;
    private enabled = false;
    private rpc: JsonRpcHandler;
    private disposable: vscode.Disposable | null = null;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
    }

    public enable(): void {
        if (this.enabled) return;
        
        this.enabled = true;
        this.rpc.notify('enable_remote_spy', { enabled: true });
        
        this.disposable = this.rpc.onNotification('remote_called', (params) => {
            this.addCall(params as RemoteCallInfo);
        });
    }

    public disable(): void {
        if (!this.enabled) return;
        
        this.enabled = false;
        this.rpc.notify('enable_remote_spy', { enabled: false });
        
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
        vscode.window.showInformationMessage(`Remote Spy: ${this.enabled ? 'Enabled' : 'Disabled'}`);
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    private addCall(call: RemoteCallInfo): void {
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

    getTreeItem(element: RemoteCallItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: RemoteCallItem): vscode.ProviderResult<RemoteCallItem[]> {
        if (element) {
            return [];
        }
        return this.calls.map(call => new RemoteCallItem(call));
    }

    public dispose(): void {
        this.disable();
    }
}
