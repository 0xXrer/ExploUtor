import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from './websocket';
import { BundlerIntegration, BundlerTool } from './bundler';

export interface ExecutionOptions {
    bundle?: boolean;
    selection?: boolean;
    timeout?: number;
}

export interface ExecutionResult {
    success: boolean;
    output?: string;
    error?: string;
}

export class ExecutionEngine {
    private pendingExecutions = new Map<number, {
        resolve: (result: ExecutionResult) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>();
    private executionId = 0;

    constructor(
        private readonly wsManager: WebSocketManager,
        private readonly bundler: BundlerIntegration,
        private readonly outputChannel: vscode.OutputChannel
    ) {
        // Listen for responses from executor
        this.wsManager.onMessage.event(this.handleMessage.bind(this));
    }

    /**
     * Execute Luau code
     */
    public async execute(code: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
        this.outputChannel.appendLine('[Executor] Starting execution...');

        // Check connection
        if (this.wsManager.status !== 'connected') {
            throw new Error('Not connected to executor. Use "Connect to Executor" command first.');
        }

        try {
            // Bundle if requested
            let finalCode = code;
            if (options.bundle) {
                const config = vscode.workspace.getConfiguration('exploitor');
                const bundlerEnabled = config.get<boolean>('bundler.enabled', true);
                const bundlerTool = config.get<string>('bundler.tool', 'darklua') as BundlerTool;

                finalCode = await this.bundler.autoBundleIfNeeded(finalCode, bundlerEnabled, bundlerTool);
            }

            // Create execution message
            const message: ExecutorMessage = {
                type: options.bundle ? 'bundle_execute' : 'execute',
                code: finalCode,
                bundled: options.bundle,
                selection: options.selection
            };

            // Send to executor
            await this.wsManager.send(message);

            // Wait for response with timeout
            const timeout = options.timeout || 30000;
            const result = await this.waitForResponse(timeout);

            this.outputChannel.appendLine(`[Executor] Execution ${result.success ? 'succeeded' : 'failed'}`);
            if (result.output) {
                this.outputChannel.appendLine(`[Executor] Output:\n${result.output}`);
            }
            if (result.error) {
                this.outputChannel.appendLine(`[Executor] Error:\n${result.error}`);
            }

            return result;

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.outputChannel.appendLine(`[Executor] Execution failed: ${errorMsg}`);
            throw err;
        }
    }

    /**
     * Execute full file
     */
    public async executeFile(document: vscode.TextDocument, bundle: boolean = false): Promise<ExecutionResult> {
        const code = document.getText();
        this.outputChannel.appendLine(`[Executor] Executing file: ${document.fileName}`);
        return await this.execute(code, { bundle, selection: false });
    }

    /**
     * Execute selected text
     */
    public async executeSelection(editor: vscode.TextEditor, bundle: boolean = false): Promise<ExecutionResult> {
        const selection = editor.selection;
        const code = editor.document.getText(selection);

        if (!code.trim()) {
            throw new Error('No code selected');
        }

        this.outputChannel.appendLine('[Executor] Executing selection...');
        return await this.execute(code, { bundle, selection: true });
    }

    /**
     * Handle incoming messages from executor
     */
    private handleMessage(message: ExecutorMessage): void {
        if (message.type === 'response') {
            const pending = this.pendingExecutions.get(this.executionId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingExecutions.delete(this.executionId);

                const result: ExecutionResult = {
                    success: message.success || false,
                    output: message.output,
                    error: message.error
                };

                pending.resolve(result);
            }
        }
    }

    /**
     * Wait for execution response
     */
    private waitForResponse(timeout: number): Promise<ExecutionResult> {
        return new Promise((resolve, reject) => {
            const id = ++this.executionId;

            const timeoutHandle = setTimeout(() => {
                this.pendingExecutions.delete(id);
                reject(new Error('Execution timeout'));
            }, timeout);

            this.pendingExecutions.set(id, {
                resolve,
                reject,
                timeout: timeoutHandle
            });
        });
    }

    /**
     * Cancel all pending executions
     */
    public cancelAll(): void {
        for (const [id, pending] of this.pendingExecutions.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Execution cancelled'));
            this.pendingExecutions.delete(id);
        }
    }

    public dispose(): void {
        this.cancelAll();
    }
}
