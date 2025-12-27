import * as vscode from 'vscode';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { ExecuteResult } from '../types/protocol';

export class ScriptExecutor {
    private static instance: ScriptExecutor;
    private rpc: JsonRpcHandler;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.rpc = JsonRpcHandler.getInstance();
        this.outputChannel = vscode.window.createOutputChannel('ExploUtor');
    }

    public static getInstance(): ScriptExecutor {
        if (!ScriptExecutor.instance) {
            ScriptExecutor.instance = new ScriptExecutor();
        }
        return ScriptExecutor.instance;
    }

    public async executeSelection(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        const code = selection.isEmpty 
            ? editor.document.getText() 
            : editor.document.getText(selection);

        if (!code.trim()) {
            vscode.window.showWarningMessage('No code selected');
            return;
        }

        await this.execute(code);
    }

    public async executeFile(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const code = editor.document.getText();
        if (!code.trim()) {
            vscode.window.showWarningMessage('File is empty');
            return;
        }

        await this.execute(code);
    }

    public async execute(code: string): Promise<void> {
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`[${this.getTimestamp()}] Executing...`);

        try {
            const result = await this.rpc.request<ExecuteResult>('execute', { code });

            if (result.success) {
                if (result.output) {
                    this.outputChannel.appendLine(result.output);
                }
                this.outputChannel.appendLine(`[${this.getTimestamp()}] Execution completed`);
            } else {
                this.outputChannel.appendLine(`[${this.getTimestamp()}] Error: ${result.error}`);
                vscode.window.showErrorMessage(`Execution failed: ${result.error}`);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`[${this.getTimestamp()}] Error: ${message}`);
            vscode.window.showErrorMessage(`Execution failed: ${message}`);
        }
    }

    private getTimestamp(): string {
        return new Date().toLocaleTimeString();
    }

    public getOutputChannel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
