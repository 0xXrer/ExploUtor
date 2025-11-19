import * as vscode from 'vscode';
import { ExecutionEngine } from '../core/executor';

export class LiveReloadManager {
    private disposables: vscode.Disposable[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private enabled: boolean = false;
    private debounceTime: number = 500;

    constructor(
        private executionEngine: ExecutionEngine,
        private outputChannel: any
    ) {
        this.loadConfiguration();
        this.setupFileWatcher();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('exploitor.liveReload')) {
                this.loadConfiguration();
            }
        }, null, this.disposables);
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('exploitor.liveReload');
        this.enabled = config.get<boolean>('enabled', false);
        this.debounceTime = config.get<number>('debounce', 500);

        if (this.enabled) {
            this.outputChannel.info('Live Reload enabled');
        }
    }

    private setupFileWatcher(): void {
        // Watch for file saves
        vscode.workspace.onDidSaveTextDocument(document => {
            if (!this.enabled) {
                return;
            }

            // Only watch Luau/Lua files
            if (document.languageId !== 'luau' && document.languageId !== 'lua') {
                return;
            }

            this.handleFileSave(document);
        }, null, this.disposables);
    }

    private handleFileSave(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath;

        // Clear existing timer for this file
        const existingTimer = this.debounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Create new debounced execution
        const timer = setTimeout(async () => {
            this.debounceTimers.delete(filePath);

            try {
                this.outputChannel.info(`[Live Reload] Executing ${document.fileName}`);

                const result = await this.executionEngine.executeFile(document, false);

                if (result.success) {
                    this.outputChannel.success(`[Live Reload] Execution successful`);
                    if (result.output) {
                        this.outputChannel.log(result.output);
                    }
                } else {
                    this.outputChannel.error(`[Live Reload] Execution failed: ${result.error}`);
                }
            } catch (error: any) {
                this.outputChannel.error(`[Live Reload] Error: ${error.message}`);
            }
        }, this.debounceTime);

        this.debounceTimers.set(filePath, timer);
    }

    public toggle(): void {
        this.enabled = !this.enabled;

        const config = vscode.workspace.getConfiguration('exploitor.liveReload');
        config.update('enabled', this.enabled, vscode.ConfigurationTarget.Global);

        const status = this.enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Live Reload ${status}`);
        this.outputChannel.info(`Live Reload ${status}`);
    }

    public dispose(): void {
        // Clear all timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Dispose all event listeners
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
