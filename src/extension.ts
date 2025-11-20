import * as vscode from 'vscode';
import { WebSocketManager, ConnectionStatus } from './core/websocket';
import { BundlerIntegration } from './core/bundler';
import { ExecutionEngine } from './core/executor';
import { LuauLSPProvider } from './language/luauProvider';
import { ExploitCompletionProvider, ExploitHoverProvider, ExploitSignatureHelpProvider } from './language/completions';
import { StatusBarManager } from './ui/statusBar';
import { OutputChannelManager } from './ui/outputChannel';
import { ExploUtorExplorerProvider } from './ui/explorerProvider';
import { LiveReloadManager } from './features/liveReload';
import { ErrorBeautifier } from './features/errorBeautifier';
import { ExecutorManager } from './features/executorManager';
import { ScriptPacker } from './features/scriptPacker';
import { VariableInspector } from './features/variableInspector';
import { Obfuscator } from './features/obfuscator';
import { ExploUtorDebugAdapterDescriptorFactory } from './features/debugger';
import { InjectionManager } from './features/injectionManager';
import { MemoryViewer } from './features/memoryViewer';
import { Profiler } from './features/profiler';
import { PatternLibrary } from './features/patternLibrary';
import { BytecodeTools } from './features/bytecodeTools';
import { PluginSystem } from './core/pluginSystem';

let wsManager: WebSocketManager;
let bundler: BundlerIntegration;
let executor: ExecutionEngine;
let lspProvider: LuauLSPProvider;
let statusBar: StatusBarManager;
let outputManager: OutputChannelManager;
let explorerProvider: ExploUtorExplorerProvider;
let liveReloadManager: LiveReloadManager;
let errorBeautifier: ErrorBeautifier;
let executorManager: ExecutorManager;
let scriptPacker: ScriptPacker;
let variableInspector: VariableInspector;
let obfuscator: Obfuscator;
let pluginSystem: PluginSystem;
let injectionManager: InjectionManager;
let memoryViewer: MemoryViewer;
let profiler: Profiler;
let patternLibrary: PatternLibrary;
let bytecodeTools: BytecodeTools;

export async function activate(context: vscode.ExtensionContext) {
    console.log('ExploUtor extension is now active');

    // Initialize output channel
    outputManager = new OutputChannelManager();
    outputManager.info('ExploUtor is activating...');

    // Initialize status bar
    statusBar = new StatusBarManager();

    // Initialize explorer provider
    explorerProvider = new ExploUtorExplorerProvider();
    const treeView = vscode.window.createTreeView('exploUtorExplorer', {
        treeDataProvider: explorerProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Initialize core components
    wsManager = new WebSocketManager(outputManager.channel);
    bundler = new BundlerIntegration(outputManager.channel);
    executor = new ExecutionEngine(wsManager, bundler, outputManager.channel);

    // Update status bar and explorer when connection changes
    wsManager.onStatusChange((status: ConnectionStatus) => {
        statusBar.updateStatus(status);

        // Update explorer provider with connection info
        const config = vscode.workspace.getConfiguration('exploitor');
        explorerProvider.updateConnectionInfo({
            status: status as any,
            host: config.get<string>('executor.host', 'localhost'),
            port: config.get<number>('executor.port', 9999),
            lastConnected: status === ConnectionStatus.Connected ? new Date() : undefined
        });
    });

    // Initialize LSP provider
    lspProvider = new LuauLSPProvider(context, outputManager.channel);
    await lspProvider.activate();

    // Initialize new features
    liveReloadManager = new LiveReloadManager(executor, outputManager);
    errorBeautifier = new ErrorBeautifier();
    executorManager = new ExecutorManager(wsManager);
    scriptPacker = new ScriptPacker(outputManager);
    variableInspector = new VariableInspector(wsManager, outputManager);
    obfuscator = new Obfuscator(outputManager);
    pluginSystem = new PluginSystem(wsManager, context);
    injectionManager = new InjectionManager(wsManager);
    vscode.window.registerTreeDataProvider('exploUtorInjection', injectionManager);
    memoryViewer = new MemoryViewer(wsManager, outputManager);
    profiler = new Profiler(wsManager, outputManager);
    patternLibrary = new PatternLibrary();
    bytecodeTools = new BytecodeTools(outputManager);

    outputManager.info('All features initialized');

    // Register language features
    registerLanguageFeatures(context);

    // Register commands
    registerCommands(context);

    // Register debug adapter
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory(
            'exploitor-debug',
            new ExploUtorDebugAdapterDescriptorFactory(wsManager)
        )
    );

    // Auto-start server on activation if configured
    const config = vscode.workspace.getConfiguration('exploitor');
    const autoStart = config.get<boolean>('server.autoStart', true);
    if (autoStart) {
        const port = config.get<number>('executor.port', 9999);
        startWebSocketServer(port);
    }

    outputManager.success('ExploUtor activated successfully');

    return pluginSystem;
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
    // Start Server command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.startServer', async () => {
            const config = vscode.workspace.getConfiguration('exploitor');
            const port = config.get<number>('executor.port', 9999);
            await startWebSocketServer(port);
        })
    );

    // Stop Server command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.stopServer', () => {
            wsManager.stopServer();
            vscode.window.showInformationMessage('WebSocket server stopped');
        })
    );

    // Execute file command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.executeFile', async (uri: vscode.Uri) => {
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

    // Refresh explorer command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.refreshExplorer', () => {
            explorerProvider.refresh();
            vscode.window.showInformationMessage('Explorer refreshed');
        })
    );

    // Clear history command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.clearHistory', () => {
            explorerProvider.clearHistory();
            vscode.window.showInformationMessage('Execution history cleared');
        })
    );

    // Quick Execute command (same as execute but for context menu)
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.quickExecute', async () => {
            await executeCommand(false, false);
        })
    );

    // Switch Executor command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.switchExecutor', async () => {
            await executorManager.switchExecutor();
        })
    );

    // Pack Scripts command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.packScripts', async () => {
            await scriptPacker.packScripts();
        })
    );

    // Inspect Variables command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.inspectVariables', async () => {
            await variableInspector.inspectVariables();
        })
    );

    // Obfuscate Script command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.obfuscateScript', async () => {
            await obfuscator.obfuscateScript();
        })
    );

    // Toggle Live Reload command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.toggleLiveReload', () => {
            liveReloadManager.toggle();
        })
    );

    // Injection Manager commands
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.killScript', (script) => {
            injectionManager.killScript(script);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.restartScript', (script) => {
            injectionManager.restartScript(script);
        })
    );

    // Memory Viewer command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.openMemoryViewer', () => {
            memoryViewer.open();
        })
    );

    // Profiler command
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.openProfiler', () => {
            profiler.open();
        })
    );

    // Pattern Library
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.insertPattern', async () => {
            await patternLibrary.insertPattern();
        })
    );

    // Bytecode Tools
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.disassemble', async () => {
            await bytecodeTools.disassemble();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.injectModifier', async () => {
            await bytecodeTools.injectModifier();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('exploitor.dumpProto', async () => {
            await bytecodeTools.dumpProto();
        })
    );

    outputManager.info('Commands registered');
}

async function startWebSocketServer(port: number): Promise<void> {
    try {
        outputManager.info(`Starting WebSocket server on port ${port}...`);
        await wsManager.startServer(port);
        vscode.window.showInformationMessage(`ExploUtor server listening on port ${port}`);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        outputManager.error(`Failed to start server: ${errorMsg}`);
        vscode.window.showErrorMessage(`Failed to start WebSocket server: ${errorMsg}`);
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

        // Add to execution history
        const fileName = editor.document.fileName.split('/').pop() || 'unknown';
        explorerProvider.addExecutionHistory({
            timestamp: new Date(),
            fileName,
            success: result.success,
            bundled: bundle,
            selection: selection,
            output: result.output,
            error: result.error
        });

        if (result.success) {
            vscode.window.showInformationMessage('Execution completed successfully');
            outputManager.success('Execution completed');
            if (result.output) {
                outputManager.log(result.output);
            }
        } else {
            // Use error beautifier to format the error
            const beautified = errorBeautifier.beautify(result.error || 'Unknown error');

            vscode.window.showErrorMessage(`Execution failed: ${beautified.errorType}`);
            outputManager.error('Execution failed:');
            outputManager.log(beautified.formatted);
        }
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Add failed execution to history
        const fileName = editor.document.fileName.split('/').pop() || 'unknown';
        explorerProvider.addExecutionHistory({
            timestamp: new Date(),
            fileName,
            success: false,
            bundled: bundle,
            selection: selection,
            error: errorMsg
        });

        // Use error beautifier for execution errors
        const beautified = errorBeautifier.beautify(errorMsg);

        vscode.window.showErrorMessage(`Execution error: ${beautified.errorType}`);
        outputManager.error('Execution error:');
        outputManager.log(beautified.formatted);
    }
}

export async function deactivate() {
    outputManager.info('ExploUtor is deactivating...');

    // Cleanup
    if (liveReloadManager) {
        liveReloadManager.dispose();
    }

    if (variableInspector) {
        variableInspector.dispose();
    }

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

    if (pluginSystem) {
        pluginSystem.dispose();
    }

    if (memoryViewer) {
        memoryViewer.dispose();
    }

    if (profiler) {
        profiler.dispose();
    }

    console.log('ExploUtor extension is now deactivated');
}
