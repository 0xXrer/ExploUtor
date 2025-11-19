import * as vscode from 'vscode';

/**
 * Represents an item in the ExploUtor explorer tree view
 */
export interface ExplorerItem {
    label: string;
    description?: string;
    tooltip?: string;
    iconPath?: vscode.ThemeIcon;
    command?: vscode.Command;
    contextValue?: string;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    children?: ExplorerItem[];
}

/**
 * Connection information displayed in the explorer
 */
export interface ConnectionInfo {
    status: 'connected' | 'disconnected' | 'connecting' | 'error';
    host: string;
    port: number;
    lastConnected?: Date;
    errorMessage?: string;
}

/**
 * Execution history item
 */
export interface ExecutionHistoryItem {
    timestamp: Date;
    fileName: string;
    success: boolean;
    bundled: boolean;
    selection: boolean;
    output?: string;
    error?: string;
}

/**
 * Extension settings displayed in the explorer
 */
export interface ExtensionSettings {
    executorHost: string;
    executorPort: number;
    bundlerEnabled: boolean;
    bundlerTool: 'wax' | 'darklua';
    lspEnabled: boolean;
}

/**
 * Categories for organizing explorer items
 */
export enum ExplorerCategory {
    Connection = 'connection',
    Commands = 'commands',
    Settings = 'settings',
    History = 'history'
}
