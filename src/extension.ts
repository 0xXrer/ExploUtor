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
            if (config.get<boolean>('remoteSpy.enabled')) {
                remoteSpyProvider.enable();
            }
            if (config.get<boolean>('closureSpy.enabled')) {
                closureSpyProvider.enable();
            }
        }
    });

    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.connect', async () => {
            try {
                await wsManager.connect();
                vscode.window.showInformationMessage('Connected to executor');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to connect: ${error}`);
            }
        }),

        vscode.commands.registerCommand('exploitor.disconnect', () => {
            wsManager.disconnect();
            vscode.window.showInformationMessage('Disconnected from executor');
        }),

        vscode.commands.registerCommand('exploitor.toggleConnection', async () => {
            if (wsManager.isConnected()) {
                wsManager.disconnect();
            } else {
                try {
                    await wsManager.connect();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to connect: ${error}`);
                }
            }
        }),

        vscode.commands.registerCommand('exploitor.executeSelection', () => executor.executeSelection()),
        vscode.commands.registerCommand('exploitor.executeFile', () => executor.executeFile()),

        vscode.commands.registerCommand('exploitor.refreshUpvalues', () => upvalueProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshConstants', () => constantProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshScripts', () => scriptProvider.refresh()),
        vscode.commands.registerCommand('exploitor.refreshModules', () => moduleProvider.refresh()),

        vscode.commands.registerCommand('exploitor.scanUpvalues', () => upvalueProvider.refresh()),
        vscode.commands.registerCommand('exploitor.scanConstants', () => constantProvider.refresh()),
        vscode.commands.registerCommand('exploitor.scanScripts', () => scriptProvider.refresh()),
        vscode.commands.registerCommand('exploitor.scanModules', () => moduleProvider.refresh()),

        vscode.commands.registerCommand('exploitor.toggleRemoteSpy', () => remoteSpyProvider.toggle()),
        vscode.commands.registerCommand('exploitor.toggleClosureSpy', () => closureSpyProvider.toggle()),
        vscode.commands.registerCommand('exploitor.clearRemoteSpy', () => remoteSpyProvider.clear()),
        vscode.commands.registerCommand('exploitor.clearClosureSpy', () => closureSpyProvider.clear()),

        vscode.commands.registerCommand('exploitor.inspectItem', (item: InspectorItem) => {
            InspectorPanel.createOrShow(context.extensionUri, item);
        }),

        vscode.commands.registerCommand('exploitor.modifyUpvalue', async (item: { upvalue: { closureId: string; index: number; value: string } }) => {
            const newValue = await vscode.window.showInputBox({
                prompt: 'Enter new value',
                value: item.upvalue.value
            });
            
            if (newValue !== undefined) {
                try {
                    await rpc.request('modify_upvalue', {
                        closureId: item.upvalue.closureId,
                        upvalueIndex: item.upvalue.index,
                        value: newValue,
                        valueType: 'string'
                    });
                    vscode.window.showInformationMessage('Upvalue modified');
                    upvalueProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to modify upvalue: ${error}`);
                }
            }
        }),

        statusBarItem,
        { dispose: () => wsManager.dispose() },
        { dispose: () => rpc.dispose() },
        { dispose: () => executor.dispose() },
        { dispose: () => remoteSpyProvider.dispose() },
        { dispose: () => closureSpyProvider.dispose() }
    );

    const config = vscode.workspace.getConfiguration('exploitor');
    
    if (config.get<boolean>('autoConnect')) {
        wsManager.connect().catch(() => {});
    }

    if (config.get<boolean>('mcp.enabled')) {
        mcpServer = new McpServer();
        mcpServer.start().catch(err => {
            console.error('Failed to start MCP server:', err);
        });
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
    if (mcpServer) {
        mcpServer.stop().catch(() => {});
    }
    wsManager?.dispose();
}
