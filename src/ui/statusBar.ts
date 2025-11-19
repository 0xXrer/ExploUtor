import * as vscode from 'vscode';
import { ConnectionStatus } from '../core/websocket';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );

        this.statusBarItem.command = 'exploitor.startServer';
        this.updateStatus(ConnectionStatus.Disconnected);
        this.statusBarItem.show();
    }

    public updateStatus(status: ConnectionStatus): void {
        switch (status) {
            case ConnectionStatus.Connected:
                this.statusBarItem.text = '$(check) ExploUtor: Connected';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Connected to executor. Click to stop server.';
                this.statusBarItem.command = 'exploitor.stopServer';
                break;

            case ConnectionStatus.Listening:
                this.statusBarItem.text = '$(radio-tower) ExploUtor: Listening';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                this.statusBarItem.tooltip = 'Listening for connections... Click to stop server.';
                this.statusBarItem.command = 'exploitor.stopServer';
                break;

            case ConnectionStatus.Disconnected:
                this.statusBarItem.text = '$(circle-slash) ExploUtor: Stopped';
                this.statusBarItem.backgroundColor = undefined;
                this.statusBarItem.tooltip = 'Server stopped. Click to start.';
                this.statusBarItem.command = 'exploitor.startServer';
                break;

            case ConnectionStatus.Error:
                this.statusBarItem.text = '$(error) ExploUtor: Error';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                this.statusBarItem.tooltip = 'Server error. Click to restart.';
                this.statusBarItem.command = 'exploitor.startServer';
                break;
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }
}
