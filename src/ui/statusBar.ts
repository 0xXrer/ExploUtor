import * as vscode from 'vscode';
import { ConnectionStatus } from '../core/websocket';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'exploitor.connectExecutor';
        this.updateStatus(ConnectionStatus.Disconnected);
        this.statusBarItem.show();
    }

    public updateStatus(status: ConnectionStatus): void {
        switch (status) {
            case ConnectionStatus.Connected:
                this.statusBarItem.text = '$(check) ExploUtor: Connected';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Connected to executor. Click to disconnect.';
                this.statusBarItem.command = 'exploitor.disconnectExecutor';
                break;

            case ConnectionStatus.Connecting:
                this.statusBarItem.text = '$(sync~spin) ExploUtor: Connecting...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.statusBarItem.tooltip = 'Connecting to executor...';
                this.statusBarItem.command = undefined;
                break;

            case ConnectionStatus.Disconnected:
                this.statusBarItem.text = '$(circle-slash) ExploUtor: Disconnected';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Not connected to executor. Click to connect.';
                this.statusBarItem.command = 'exploitor.connectExecutor';
                break;

            case ConnectionStatus.Error:
                this.statusBarItem.text = '$(error) ExploUtor: Error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = 'Connection error. Click to reconnect.';
                this.statusBarItem.command = 'exploitor.connectExecutor';
                break;
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
