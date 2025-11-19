import * as vscode from 'vscode';
import { WebSocketManager, ConnectionStatus } from './core/websocket';
import { BundlerIntegration } from './core/bundler';
import { ExecutionEngine } from './core/executor';
import { LuauLSPProvider } from './language/luauProvider';
import { ExploitCompletionProvider, ExploitHoverProvider, ExploitSignatureHelpProvider } from './language/completions';
import { StatusBarManager } from './ui/statusBar';
import { OutputChannelManager } from './ui/outputChannel';

let wsManager: WebSocketManager;
let bundler: BundlerIntegration;
let executor: ExecutionEngine;
let lspProvider: LuauLSPProvider;
let statusBar: StatusBarManager;
let outputManager: OutputChannelManager;

export async function activate(context: vscode.ExtensionContext) {
    console.log('ExploUtor extension is now active');

    // Initialize output channel
    outputManager = new OutputChannelManager();
    outputManager.info('ExploUtor is activating...');

    // Initialize status bar
    statusBar = new StatusBarManager();

    // Initialize core components
    wsManager = new WebSocketManager(outputManager.channel);
    bundler = new BundlerIntegration(outputManager.channel);
    executor = new ExecutionEngine(wsManager, bundler, outputManager.channel);

    // Update status bar when connection changes
    wsManager.onStatusChange((status: ConnectionStatus) => {
        statusBar.updateStatus(status);
    });

    // Initialize LSP provider
    lspProvider = new LuauLSPProvider(context, outputManager.channel);
    await lspProvider.activate();

    // Register language features
    registerLanguageFeatures(context);

    // Register commands
    registerCommands(context);

    // Auto-connect on activation if configured
    const config = vscode.workspace.getConfiguration('exploitor');
    const autoConnect = config.get<boolean>('executor.autoConnect', false);
    if (autoConnect) {
        const host = config.get<string>('executor.host', 'localhost');
        const port = config.get<number>('executor.port', 9999);
        connectToExecutor(host, port);
    }

    outputManager.success('ExploUtor activated successfully');
}

function registerLanguageFeatures(context: vscode.ExtensionContext) {
    // Register completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            ['luau', 'lua'],
            new ExploitCompletionProvider(),
            '.'
        )
    );

    // Register hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            ['luau', 'lua'],
            new ExploitHoverProvider()
        )
    );

    // Register signature help provider
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            ['luau', 'lua'],
            new ExploitSignatureHelpProvider(),
            '(', ','
        )
    );

    outputManager.info('Language features registered');
}

function registerCommands(context: vscode.ExtensionContext) {
    // Connect command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.connectExecutor', async () => {
            const config = vscode.workspace.getConfiguration('exploitor');
            const host = config.get<string>('executor.host', 'localhost');
            const port = config.get<number>('executor.port', 9999);
            await connectToExecutor(host, port);
        })
    );

    // Disconnect command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.disconnectExecutor', () => {
            wsManager.disconnect();
            vscode.window.showInformationMessage('Disconnected from executor');
        })
    );

    // Execute file command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.execute', async () => {
            await executeCommand(false, false);
        })
    );

    // Execute selection command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.executeSelection', async () => {
            await executeCommand(false, true);
        })
    );

    // Bundle and execute command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.bundleExecute', async () => {
            await executeCommand(true, false);
        })
    );

    outputManager.info('Commands registered');
}

async function connectToExecutor(host: string, port: number): Promise<void> {
    try {
        outputManager.info(`Connecting to executor at ${host}:${port}...`);
        await wsManager.connect(host, port);
        vscode.window.showInformationMessage(`Connected to executor at ${host}:${port}`);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        outputManager.error(`Failed to connect: ${errorMsg}`);
        vscode.window.showErrorMessage(`Failed to connect to executor: ${errorMsg}`);
    }
}

async function executeCommand(bundle: boolean, selection: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    // Check if file is Luau
    if (editor.document.languageId !== 'luau' && editor.document.languageId !== 'lua') {
        vscode.window.showWarningMessage('Not a Luau/Lua file');
        return;
    }

    // Check connection
    if (wsManager.status !== ConnectionStatus.Connected) {
        const result = await vscode.window.showWarningMessage(
            'Not connected to executor. Connect now?',
            'Connect',
            'Cancel'
        );

        if (result === 'Connect') {
            await vscode.commands.executeCommand('exploitor.connectExecutor');
            // Wait a bit for connection
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Re-check connection status (use type assertion to bypass narrowing)
            const currentStatus: ConnectionStatus = wsManager.status as ConnectionStatus;
            if (currentStatus !== ConnectionStatus.Connected) {
                vscode.window.showErrorMessage('Failed to connect to executor');
                return;
            }
        } else {
            return;
        }
    }

    try {
        outputManager.show();
        outputManager.info(`${bundle ? 'Bundling and executing' : 'Executing'} ${selection ? 'selection' : 'file'}...`);

        let result;
        if (selection) {
            result = await executor.executeSelection(editor, bundle);
        } else {
            result = await executor.executeFile(editor.document, bundle);
        }

        if (result.success) {
            vscode.window.showInformationMessage('Execution completed successfully');
            outputManager.success('Execution completed');
        } else {
            vscode.window.showErrorMessage(`Execution failed: ${result.error}`);
            outputManager.error(`Execution failed: ${result.error}`);
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Execution error: ${errorMsg}`);
        outputManager.error(`Execution error: ${errorMsg}`);
    }
}

export async function deactivate() {
    outputManager.info('ExploUtor is deactivating...');

    // Cleanup
    if (executor) {
        executor.dispose();
    }

    if (wsManager) {
        wsManager.dispose();
    }

    if (lspProvider) {
        await lspProvider.deactivate();
    }

    if (statusBar) {
        statusBar.dispose();
    }

    if (outputManager) {
        outputManager.dispose();
    }

    console.log('ExploUtor extension is now deactivated');
}
