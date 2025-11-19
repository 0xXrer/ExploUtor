import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from '../core/websocket';

export interface RunningScript {
    id: string;
    name: string;
    status: 'running' | 'paused' | 'error';
    startTime: number;
    memoryUsage?: string;
}

export class InjectionManager implements vscode.TreeDataProvider<RunningScript> {
    private _onDidChangeTreeData: vscode.EventEmitter<RunningScript | undefined | null | void> = new vscode.EventEmitter<RunningScript | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RunningScript | undefined | null | void> = this._onDidChangeTreeData.event;

    private scripts: Map<string, RunningScript> = new Map();

    constructor(private readonly wsManager: WebSocketManager) {
        this.wsManager.onMessage(this.handleMessage.bind(this));
    }

    getTreeItem(element: RunningScript): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.name);
        treeItem.description = element.status;
        treeItem.contextValue = 'runningScript';

        switch (element.status) {
            case 'running':
                treeItem.iconPath = new vscode.ThemeIcon('play');
                break;
            case 'paused':
                treeItem.iconPath = new vscode.ThemeIcon('debug-pause');
                break;
            case 'error':
                treeItem.iconPath = new vscode.ThemeIcon('error');
                break;
        }

        return treeItem;
    }

    getChildren(element?: RunningScript): vscode.ProviderResult<RunningScript[]> {
        if (element) {
            return [];
        }
        return Array.from(this.scripts.values());
    }

    private handleMessage(message: ExecutorMessage) {
        if (message.type === 'response' && message.output) {
            // Parse script updates from output if formatted specifically
            // Or better, add a new message type for script updates
        }
        // For now, we'll mock some data or wait for specific events
    }

    public addScript(name: string) {
        const id = Math.random().toString(36).substring(7);
        this.scripts.set(id, {
            id,
            name,
            status: 'running',
            startTime: Date.now()
        });
        this._onDidChangeTreeData.fire();
    }

    public killScript(script: RunningScript) {
        this.wsManager.send({
            type: 'execute',
            code: `killScript("${script.id}")` // Hypothetical API
        });
        this.scripts.delete(script.id);
        this._onDidChangeTreeData.fire();
    }

    public restartScript(script: RunningScript) {
        this.wsManager.send({
            type: 'execute',
            code: `restartScript("${script.id}")` // Hypothetical API
        });
    }

    public refresh() {
        this._onDidChangeTreeData.fire();
    }
}
