import * as vscode from 'vscode';
import { WebSocketManager } from '../core/websocket';

export interface ExecutorProfile {
    name: string;
    host: string;
    port: number;
}

export class ExecutorManager {
    private profiles: ExecutorProfile[] = [];
    private activeProfile: string = 'Default';
    private wsManager: WebSocketManager;

    constructor(wsManager: WebSocketManager) {
        this.wsManager = wsManager;
        this.loadProfiles();

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('exploitor.executors') ||
                e.affectsConfiguration('exploitor.activeExecutor')) {
                this.loadProfiles();
            }
        });
    }

    private loadProfiles(): void {
        const config = vscode.workspace.getConfiguration('exploitor');
        this.profiles = config.get<ExecutorProfile[]>('executors', [
            { name: 'Default', host: 'localhost', port: 9999 }
        ]);
        this.activeProfile = config.get<string>('activeExecutor', 'Default');
    }

    public async switchExecutor(): Promise<void> {
        const items: vscode.QuickPickItem[] = this.profiles.map(profile => ({
            label: profile.name,
            description: `${profile.host}:${profile.port}`,
            detail: profile.name === this.activeProfile ? '(Active)' : undefined
        }));

        items.push({
            label: '$(add) Add New Executor',
            description: 'Create a new executor profile'
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select executor profile'
        });

        if (!selected) {
            return;
        }

        if (selected.label.includes('Add New')) {
            await this.addNewExecutor();
            return;
        }

        const profile = this.profiles.find(p => p.name === selected.label);
        if (!profile) {
            return;
        }

        await this.setActiveProfile(profile);
    }

    private async addNewExecutor(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter executor profile name',
            placeHolder: 'My Executor'
        });

        if (!name) {
            return;
        }

        const host = await vscode.window.showInputBox({
            prompt: 'Enter executor host',
            value: 'localhost',
            placeHolder: 'localhost'
        });

        if (!host) {
            return;
        }

        const portStr = await vscode.window.showInputBox({
            prompt: 'Enter executor port',
            value: '9999',
            placeHolder: '9999',
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return 'Invalid port number';
                }
                return null;
            }
        });

        if (!portStr) {
            return;
        }

        const port = parseInt(portStr);
        const profile: ExecutorProfile = { name, host, port };

        this.profiles.push(profile);
        await this.saveProfiles();
        await this.setActiveProfile(profile);

        vscode.window.showInformationMessage(`Executor profile "${name}" created and activated`);
    }

    private async saveProfiles(): Promise<void> {
        const config = vscode.workspace.getConfiguration('exploitor');
        await config.update('executors', this.profiles, vscode.ConfigurationTarget.Global);
    }

    private async setActiveProfile(profile: ExecutorProfile): Promise<void> {
        this.activeProfile = profile.name;

        const config = vscode.workspace.getConfiguration('exploitor');
        await config.update('activeExecutor', profile.name, vscode.ConfigurationTarget.Global);

        // Update connection settings
        await config.update('executor.host', profile.host, vscode.ConfigurationTarget.Global);
        await config.update('executor.port', profile.port, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage(`Switched to executor: ${profile.name}`);

        // Reconnect if already connected
        if (this.wsManager.status === 'connected') {
            const reconnect = await vscode.window.showInformationMessage(
                'Reconnect to the new executor?',
                'Yes', 'No'
            );

            if (reconnect === 'Yes') {
                await this.wsManager.disconnect();
                await this.wsManager.connect(profile.host, profile.port);
            }
        }
    }

    public getActiveProfile(): ExecutorProfile | undefined {
        return this.profiles.find(p => p.name === this.activeProfile);
    }

    public getAllProfiles(): ExecutorProfile[] {
        return [...this.profiles];
    }

    public async deleteProfile(name: string): Promise<void> {
        if (this.profiles.length <= 1) {
            vscode.window.showWarningMessage('Cannot delete the last executor profile');
            return;
        }

        const index = this.profiles.findIndex(p => p.name === name);
        if (index === -1) {
            return;
        }

        this.profiles.splice(index, 1);
        await this.saveProfiles();

        if (this.activeProfile === name) {
            await this.setActiveProfile(this.profiles[0]);
        }

        vscode.window.showInformationMessage(`Executor profile "${name}" deleted`);
    }
}
