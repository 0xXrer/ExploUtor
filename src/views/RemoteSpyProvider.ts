import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';

interface RemoteCall {
    timestamp: number;
    remoteName: string;
    remotePath: string;
    remoteType: string;
    arguments: string;
    traceback: string;
}

class RemoteCallItem extends vscode.TreeItem {
    constructor(public readonly call: RemoteCall) {
        const time = new Date(call.timestamp).toLocaleTimeString();
        super(`${time} - ${call.remoteName}`, vscode.TreeItemCollapsibleState.None);
        this.description = call.remoteType;
        this.tooltip = new vscode.MarkdownString();
        this.tooltip.appendMarkdown(`**${call.remoteName}** (${call.remoteType})\n\n`);
        this.tooltip.appendCodeblock(call.arguments, 'lua');
        this.tooltip.appendMarkdown(`\n\n**Traceback:**\n\`\`\`\n${call.traceback}\n\`\`\``);
        this.iconPath = call.remoteType === 'RemoteEvent' ? new vscode.ThemeIcon('broadcast') : new vscode.ThemeIcon('call-outgoing');
    }
}

export class RemoteSpyProvider implements vscode.TreeDataProvider<RemoteCallItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private calls: RemoteCall[] = [];
    private enabled = false;
    private rpc = JsonRpcHandler.getInstance();
    private disposable: vscode.Disposable | null = null;

    enable(): void {
        if (this.enabled) return;
        this.enabled = true;
        this.rpc.notify('enable_remote_spy', { enabled: true });
        this.disposable = this.rpc.onNotification('remote_called', (p) => {
            this.calls.unshift(p as RemoteCall);
            if (this.calls.length > 200) this.calls.pop();
            this._onDidChangeTreeData.fire();
        });
    }

    disable(): void {
        if (!this.enabled) return;
        this.enabled = false;
        this.rpc.notify('enable_remote_spy', { enabled: false });
        this.disposable?.dispose();
        this.disposable = null;
    }

    toggle(): void {
        this.enabled ? this.disable() : this.enable();
        vscode.window.showInformationMessage(`Remote Spy: ${this.enabled ? 'ON' : 'OFF'}`);
    }

    clear(): void {
        this.calls = [];
        this._onDidChangeTreeData.fire();
    }

    isEnabled() { return this.enabled; }
    getTreeItem(el: RemoteCallItem) { return el; }
    getChildren() { return this.calls.map(c => new RemoteCallItem(c)); }
    dispose() { this.disable(); }
}
