import * as vscode from 'vscode';
import { WebSocketManager, ConnectionState } from './connection/WebSocketManager';
import { JsonRpcHandler } from './connection/JsonRpcHandler';
import { ScriptExecutor } from './execution/ScriptExecutor';
import { UpvalueTreeProvider } from './views/UpvalueTreeProvider';
import { ConstantTreeProvider } from './views/ConstantTreeProvider';
import { ScriptTreeProvider } from './views/ScriptTreeProvider';
import { ModuleTreeProvider } from './views/ModuleTreeProvider';
import { RemoteSpyProvider } from './views/RemoteSpyProvider';
import { ClosureSpyProvider } from './views/ClosureSpyProvider';
import { InspectorPanel } from './panels/InspectorPanel';
import { McpServer } from './mcp/McpServer';
import { InspectorItem } from './types/protocol';

let statusBarItem: vscode.StatusBarItem;
let wsManager: WebSocketManager;
let mcpServer: McpServer | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    wsManager = WebSocketManager.getInstance();
    const rpc = JsonRpcHandler.getInstance();
    const executor = ScriptExecutor.getInstance();

    const upvalueProvider = new UpvalueTreeProvider();
    const constantProvider = new ConstantTreeProvider();
    const scriptProvider = new ScriptTreeProvider();
    const moduleProvider = new ModuleTreeProvider();
    const remoteSpyProvider = new RemoteSpyProvider();
    const closureSpyProvider = new ClosureSpyProvider();

    vscode.window.registerTreeDataProvider('exploitor.upvalues', upvalueProvider);
    vscode.window.registerTreeDataProvider('exploitor.constants', constantProvider);
    vscode.window.registerTreeDataProvider('exploitor.scripts', scriptProvider);
    vscode.window.registerTreeDataProvider('exploitor.modules', moduleProvider);
    vscode.window.registerTreeDataProvider('exploitor.remoteSpy', remoteSpyProvider);
    vscode.window.registerTreeDataProvider('exploitor.closureSpy', closureSpyProvider);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'exploitor.toggleConnection';
    updateStatusBar('disconnected');
    statusBarItem.show();

    wsManager.onStateChange((state: ConnectionState) => {
        updateStatusBar(state);
        if (state === 'connected') {
            const config = vscode.workspace.getConfiguration('exploitor');
            if (config.get<boolean>('remoteSpy.enabled')) remoteSpyProvider.enable();
        }
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.connect', async () => {
            try { await wsManager.connect(); vscode.window.showInformationMessage('Connected'); }
            catch (e) { vscode.window.showErrorMessage(`Failed: ${e}`); }
        }),
        vscode.commands.registerCommand('exploitor.disconnect', () => {
            wsManager.disconnect();
            vscode.window.showInformationMessage('Disconnected');
        }),
        vscode.commands.registerCommand('exploitor.toggleConnection', async () => {
            if (wsManager.isConnected()) wsManager.disconnect();
            else try { await wsManager.connect(); } catch (e) { vscode.window.showErrorMessage(`Failed: ${e}`); }
        }),

        vscode.commands.registerCommand('exploitor.executeSelection', () => executor.executeSelection()),
        vscode.commands.registerCommand('exploitor.executeFile', () => executor.executeFile()),

        // Search commands
        vscode.commands.registerCommand('exploitor.searchUpvalues', async () => {
            const q = await vscode.window.showInputBox({ prompt: 'Search upvalues by name or value' });
            if (q) upvalueProvider.search(q);
        }),
        vscode.commands.registerCommand('exploitor.searchConstants', async () => {
            const q = await vscode.window.showInputBox({ prompt: 'Search constants by value' });
            if (q) constantProvider.search(q);
        }),
        vscode.commands.registerCommand('exploitor.searchScripts', async () => {
            const q = await vscode.window.showInputBox({ prompt: 'Search scripts by name' });
            if (q) scriptProvider.search(q);
        }),
        vscode.commands.registerCommand('exploitor.searchModules', async () => {
            const q = await vscode.window.showInputBox({ prompt: 'Search modules by name' });
            if (q) moduleProvider.search(q);
        }),
        vscode.commands.registerCommand('exploitor.searchClosures', async () => {
            const q = await vscode.window.showInputBox({ prompt: 'Search closures by name or constant' });
            if (q) closureSpyProvider.search(q, true);
        }),

        vscode.commands.registerCommand('exploitor.refreshUpvalues', () => upvalueProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshConstants', () => constantProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshScripts', () => scriptProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshModules', () => moduleProvider.refresh()),

        vscode.commands.registerCommand('exploitor.toggleRemoteSpy', () => remoteSpyProvider.toggle()),
        vscode.commands.registerCommand('exploitor.toggleClosureSpy', () => closureSpyProvider.clear()),
        vscode.commands.registerCommand('exploitor.clearRemoteSpy', () => remoteSpyProvider.clear()),
        vscode.commands.registerCommand('exploitor.clearClosureSpy', () => closureSpyProvider.clear()),

        vscode.commands.registerCommand('exploitor.readScript', async (path: string) => {
            try {
                const result = await rpc.request<{ source: string }>('read_script', { path });
                const doc = await vscode.workspace.openTextDocument({ content: result.source, language: 'lua' });
                vscode.window.showTextDocument(doc);
            } catch (e) { vscode.window.showErrorMessage(`Failed: ${e}`); }
        }),

        vscode.commands.registerCommand('exploitor.inspectItem', (item: InspectorItem) => {
            InspectorPanel.createOrShow(context.extensionUri, item);
        }),

        statusBarItem,
        { dispose: () => wsManager.dispose() },
        { dispose: () => rpc.dispose() },
        { dispose: () => executor.dispose() },
        { dispose: () => remoteSpyProvider.dispose() },
        { dispose: () => closureSpyProvider.dispose() }
    );

    const config = vscode.workspace.getConfiguration('exploitor');
    if (config.get<boolean>('autoConnect')) wsManager.connect().catch(() => {});
    if (config.get<boolean>('mcp.enabled')) {
        mcpServer = new McpServer();
        mcpServer.start().catch(e => console.error('MCP start failed:', e));
    }
}

function updateStatusBar(state: ConnectionState): void {
    switch (state) {
        case 'connected':
            statusBarItem.text = '$(plug) ExploUtor: Connected';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'connecting':
            statusBarItem.text = '$(sync~spin) ExploUtor: Connecting...';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            break;
        case 'disconnected':
            statusBarItem.text = '$(debug-disconnect) ExploUtor: Disconnected';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
            break;
    }
}

export function deactivate(): void {
    mcpServer?.stop().catch(() => {});
    wsManager?.dispose();
}
