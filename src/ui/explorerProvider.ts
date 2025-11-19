import * as vscode from 'vscode';
import { ConnectionInfo, ExplorerItem, ExecutionHistoryItem, ExtensionSettings, ExplorerCategory } from './explorerInterfaces';

/**
 * Tree data provider for the ExploUtor explorer view
 */
export class ExploUtorExplorerProvider implements vscode.TreeDataProvider<ExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExplorerItem | undefined | null | void> = new vscode.EventEmitter<ExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ExplorerItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private connectionInfo: ConnectionInfo;
    private executionHistory: ExecutionHistoryItem[] = [];
    private settings: ExtensionSettings;

    constructor() {
        // Initialize with default values
        this.connectionInfo = {
            status: 'disconnected',
            host: 'localhost',
            port: 9999
        };

        this.settings = {
            executorHost: 'localhost',
            executorPort: 9999,
            bundlerEnabled: true,
            bundlerTool: 'darklua',
            lspEnabled: true
        };

        // Load settings from VS Code configuration
        this.loadSettings();
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update connection information
     */
    updateConnectionInfo(info: Partial<ConnectionInfo>): void {
        this.connectionInfo = { ...this.connectionInfo, ...info };
        this.refresh();
    }

    /**
     * Add an execution to history
     */
    addExecutionHistory(item: ExecutionHistoryItem): void {
        this.executionHistory.unshift(item);
        // Keep only last 10 items
        if (this.executionHistory.length > 10) {
            this.executionHistory = this.executionHistory.slice(0, 10);
        }
        this.refresh();
    }

    /**
     * Clear execution history
     */
    clearHistory(): void {
        this.executionHistory = [];
        this.refresh();
    }

    /**
     * Load settings from VS Code configuration
     */
    loadSettings(): void {
        const config = vscode.workspace.getConfiguration('exploitor');
        this.settings = {
            executorHost: config.get('executor.host', 'localhost'),
            executorPort: config.get('executor.port', 9999),
            bundlerEnabled: config.get('bundler.enabled', true),
            bundlerTool: config.get('bundler.tool', 'darklua'),
            lspEnabled: config.get('lsp.enabled', true)
        };
        this.refresh();
    }

    getTreeItem(element: ExplorerItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            element.label,
            element.collapsibleState || vscode.TreeItemCollapsibleState.None
        );

        treeItem.description = element.description;
        treeItem.tooltip = element.tooltip;
        treeItem.iconPath = element.iconPath;
        treeItem.command = element.command;
        treeItem.contextValue = element.contextValue;

        return treeItem;
    }

    getChildren(element?: ExplorerItem): Thenable<ExplorerItem[]> {
        if (!element) {
            // Root level - show main categories
            return Promise.resolve(this.getRootItems());
        }

        // Return children if they exist
        return Promise.resolve(element.children || []);
    }

    /**
     * Get root level items (main categories)
     */
    private getRootItems(): ExplorerItem[] {
        return [
            this.getConnectionCategory(),
            this.getCommandsCategory(),
            this.getSettingsCategory(),
            this.getHistoryCategory()
        ];
    }

    /**
     * Get connection status category
     */
    private getConnectionCategory(): ExplorerItem {
        const statusIcon = this.getStatusIcon(this.connectionInfo.status);
        const statusLabel = this.connectionInfo.status.charAt(0).toUpperCase() + this.connectionInfo.status.slice(1);

        const children: ExplorerItem[] = [
            {
                label: `Status: ${statusLabel}`,
                iconPath: statusIcon,
                tooltip: `Connection status: ${statusLabel}`,
                contextValue: 'connection.status'
            },
            {
                label: `Host: ${this.connectionInfo.host}`,
                iconPath: new vscode.ThemeIcon('server'),
                tooltip: 'Executor host address',
                contextValue: 'connection.host'
            },
            {
                label: `Port: ${this.connectionInfo.port}`,
                iconPath: new vscode.ThemeIcon('port'),
                tooltip: 'Executor port number',
                contextValue: 'connection.port'
            }
        ];

        if (this.connectionInfo.lastConnected) {
            children.push({
                label: `Last Connected: ${this.formatDate(this.connectionInfo.lastConnected)}`,
                iconPath: new vscode.ThemeIcon('clock'),
                tooltip: this.connectionInfo.lastConnected.toLocaleString(),
                contextValue: 'connection.lastConnected'
            });
        }

        if (this.connectionInfo.errorMessage) {
            children.push({
                label: `Error: ${this.connectionInfo.errorMessage}`,
                iconPath: new vscode.ThemeIcon('error'),
                tooltip: this.connectionInfo.errorMessage,
                contextValue: 'connection.error'
            });
        }

        return {
            label: 'Connection',
            iconPath: statusIcon,
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            contextValue: ExplorerCategory.Connection,
            children
        };
    }

    /**
     * Get commands category
     */
    private getCommandsCategory(): ExplorerItem {
        const isConnected = this.connectionInfo.status === 'connected';

        return {
            label: 'Commands',
            iconPath: new vscode.ThemeIcon('terminal'),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: ExplorerCategory.Commands,
            children: [
                {
                    label: 'Execute File',
                    iconPath: new vscode.ThemeIcon('play'),
                    tooltip: 'Execute the current Luau file (F5)',
                    command: isConnected ? {
                        command: 'exploitor.execute',
                        title: 'Execute File'
                    } : undefined,
                    contextValue: 'command.execute'
                },
                {
                    label: 'Execute Selection',
                    iconPath: new vscode.ThemeIcon('play-circle'),
                    tooltip: 'Execute selected code (Shift+F5)',
                    command: isConnected ? {
                        command: 'exploitor.executeSelection',
                        title: 'Execute Selection'
                    } : undefined,
                    contextValue: 'command.executeSelection'
                },
                {
                    label: 'Bundle & Execute',
                    iconPath: new vscode.ThemeIcon('package'),
                    tooltip: 'Bundle and execute the current file',
                    command: isConnected ? {
                        command: 'exploitor.bundleExecute',
                        title: 'Bundle & Execute'
                    } : undefined,
                    contextValue: 'command.bundleExecute'
                },
                {
                    label: isConnected ? 'Disconnect' : 'Connect',
                    iconPath: new vscode.ThemeIcon(isConnected ? 'debug-disconnect' : 'plug'),
                    tooltip: isConnected ? 'Disconnect from executor' : 'Connect to executor',
                    command: {
                        command: isConnected ? 'exploitor.disconnectExecutor' : 'exploitor.connectExecutor',
                        title: isConnected ? 'Disconnect' : 'Connect'
                    },
                    contextValue: isConnected ? 'command.disconnect' : 'command.connect'
                }
            ]
        };
    }

    /**
     * Get settings category
     */
    private getSettingsCategory(): ExplorerItem {
        return {
            label: 'Settings',
            iconPath: new vscode.ThemeIcon('settings-gear'),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: ExplorerCategory.Settings,
            children: [
                {
                    label: `Bundler: ${this.settings.bundlerEnabled ? 'Enabled' : 'Disabled'}`,
                    iconPath: new vscode.ThemeIcon(this.settings.bundlerEnabled ? 'check' : 'x'),
                    tooltip: `Bundler is ${this.settings.bundlerEnabled ? 'enabled' : 'disabled'}`,
                    contextValue: 'settings.bundler'
                },
                {
                    label: `Bundler Tool: ${this.settings.bundlerTool}`,
                    iconPath: new vscode.ThemeIcon('tools'),
                    tooltip: `Current bundler: ${this.settings.bundlerTool}`,
                    contextValue: 'settings.bundlerTool'
                },
                {
                    label: `LSP: ${this.settings.lspEnabled ? 'Enabled' : 'Disabled'}`,
                    iconPath: new vscode.ThemeIcon(this.settings.lspEnabled ? 'check' : 'x'),
                    tooltip: `Language Server Protocol is ${this.settings.lspEnabled ? 'enabled' : 'disabled'}`,
                    contextValue: 'settings.lsp'
                },
                {
                    label: 'Open Settings',
                    iconPath: new vscode.ThemeIcon('edit'),
                    tooltip: 'Open ExploUtor settings',
                    command: {
                        command: 'workbench.action.openSettings',
                        title: 'Open Settings',
                        arguments: ['exploitor']
                    },
                    contextValue: 'settings.open'
                }
            ]
        };
    }

    /**
     * Get execution history category
     */
    private getHistoryCategory(): ExplorerItem {
        const children: ExplorerItem[] = this.executionHistory.map((item, index) => {
            const statusIcon = item.success ?
                new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed')) :
                new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));

            const badges: string[] = [];
            if (item.bundled) badges.push('bundled');
            if (item.selection) badges.push('selection');

            const description = badges.length > 0 ? `[${badges.join(', ')}]` : undefined;
            const tooltipLines = [
                `File: ${item.fileName}`,
                `Time: ${item.timestamp.toLocaleString()}`,
                `Status: ${item.success ? 'Success' : 'Failed'}`,
                item.bundled ? 'Bundled: Yes' : 'Bundled: No',
                item.selection ? 'Selection: Yes' : 'Selection: No'
            ];

            if (item.error) {
                tooltipLines.push(`Error: ${item.error}`);
            }

            return {
                label: `${this.formatDate(item.timestamp)} - ${item.fileName}`,
                description,
                iconPath: statusIcon,
                tooltip: tooltipLines.join('\n'),
                contextValue: 'history.item'
            };
        });

        if (children.length === 0) {
            children.push({
                label: 'No executions yet',
                iconPath: new vscode.ThemeIcon('info'),
                tooltip: 'Execute a file to see history',
                contextValue: 'history.empty'
            });
        }

        return {
            label: `History (${this.executionHistory.length})`,
            iconPath: new vscode.ThemeIcon('history'),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: ExplorerCategory.History,
            children
        };
    }

    /**
     * Get icon for connection status
     */
    private getStatusIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'connected':
                return new vscode.ThemeIcon('debug-disconnect', new vscode.ThemeColor('testing.iconPassed'));
            case 'connecting':
                return new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('testing.iconQueued'));
            case 'error':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'disconnected':
            default:
                return new vscode.ThemeIcon('debug-disconnect', new vscode.ThemeColor('testing.iconSkipped'));
        }
    }

    /**
     * Format date for display
     */
    private formatDate(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }
}
