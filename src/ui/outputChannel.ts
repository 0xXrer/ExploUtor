import * as vscode from 'vscode';

export class OutputChannelManager {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('ExploUtor');
    }

    public get channel(): vscode.OutputChannel {
        return this.outputChannel;
    }

    public log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    public info(message: string): void {
        this.log(`INFO: ${message}`);
    }

    public warn(message: string): void {
        this.log(`WARN: ${message}`);
    }

    public error(message: string): void {
        this.log(`ERROR: ${message}`);
    }

    public success(message: string): void {
        this.log(`SUCCESS: ${message}`);
    }

    public clear(): void {
        this.outputChannel.clear();
    }

    public show(preserveFocus: boolean = true): void {
        this.outputChannel.show(preserveFocus);
    }

    public hide(): void {
        this.outputChannel.hide();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
