import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from '../core/websocket';

export class ExploUtorDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    constructor(private readonly wsManager: WebSocketManager) { }

    createDebugAdapterDescriptor(
        session: vscode.DebugSession,
        executable: vscode.DebugAdapterExecutable | undefined
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(new ExploUtorDebugSession(this.wsManager));
    }
}

class ExploUtorDebugSession implements vscode.DebugAdapter {
    private _onDidSendMessage = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
    readonly onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this._onDidSendMessage.event;

    private seq = 1;
    private breakpoints: Map<string, any[]> = new Map();

    constructor(private readonly wsManager: WebSocketManager) {
        this.wsManager.onMessage(this.handleExecutorMessage.bind(this));
    }

    handleMessage(message: vscode.DebugProtocolMessage): void {
        const request = message as any;
        if (request.type === 'request') {
            this.dispatchRequest(request);
        }
    }

    private dispatchRequest(request: any) {
        switch (request.command) {
            case 'initialize':
                this.sendResponse(request, {
                    supportsConfigurationDoneRequest: true,
                    supportsRestartRequest: true,
                    supportsStepBack: false,
                    supportsValueFormattingOptions: false,
                    supportsFunctionBreakpoints: false,
                    supportsEvaluateForHovers: true,
                    exceptionBreakpointFilters: [
                        { filter: 'namedException', label: 'Named Exception', default: false },
                        { filter: 'otherExceptions', label: 'Other Exceptions', default: true }
                    ]
                });
                this.sendEvent('initialized');
                break;

            case 'attach':
                this.sendResponse(request);
                this.sendEvent('process', { name: 'Roblox Executor' });
                break;

            case 'setBreakpoints':
                const args = request.arguments;
                const file = args.source.path;
                const bps = args.breakpoints || [];
                this.breakpoints.set(file, bps);

                // Send to executor
                this.wsManager.send({
                    type: 'debug_event',
                    debugType: 'breakpoint',
                    code: JSON.stringify({ file, breakpoints: bps })
                });

                this.sendResponse(request, {
                    breakpoints: bps.map((bp: any) => ({ verified: true, line: bp.line }))
                });
                break;

            case 'configurationDone':
                this.sendResponse(request);
                break;

            case 'threads':
                this.sendResponse(request, {
                    threads: [{ id: 1, name: 'Main Thread' }]
                });
                break;

            case 'stackTrace':
                // Request stack trace from executor if stopped
                this.sendResponse(request, {
                    stackFrames: [
                        { id: 1, name: 'Main', line: 1, column: 1, source: { path: 'unknown' } }
                    ],
                    totalFrames: 1
                });
                break;

            case 'scopes':
                this.sendResponse(request, {
                    scopes: [
                        { name: 'Locals', variablesReference: 1, expensive: false },
                        { name: 'Globals', variablesReference: 2, expensive: true }
                    ]
                });
                break;

            case 'variables':
                // Request variables from executor
                this.sendResponse(request, {
                    variables: []
                });
                break;

            case 'continue':
                this.wsManager.send({ type: 'debug_event', debugType: 'step', code: 'continue' });
                this.sendResponse(request);
                break;

            case 'next':
                this.wsManager.send({ type: 'debug_event', debugType: 'step', code: 'over' });
                this.sendResponse(request);
                break;

            case 'stepIn':
                this.wsManager.send({ type: 'debug_event', debugType: 'step', code: 'into' });
                this.sendResponse(request);
                break;

            case 'stepOut':
                this.wsManager.send({ type: 'debug_event', debugType: 'step', code: 'out' });
                this.sendResponse(request);
                break;

            case 'disconnect':
                this.sendResponse(request);
                break;

            default:
                this.sendErrorResponse(request, 1001, `Unknown command: ${request.command}`);
        }
    }

    private handleExecutorMessage(message: ExecutorMessage) {
        if (message.type === 'debug_event') {
            if (message.debugType === 'pause') {
                this.sendEvent('stopped', {
                    reason: 'breakpoint',
                    threadId: 1,
                    allThreadsStopped: true
                });
            }
        }
    }

    private sendResponse(request: any, body?: any) {
        this._onDidSendMessage.fire({
            type: 'response',
            seq: this.seq++,
            request_seq: request.seq,
            command: request.command,
            success: true,
            body
        } as any);
    }

    private sendErrorResponse(request: any, id: number, format: string) {
        this._onDidSendMessage.fire({
            type: 'response',
            seq: this.seq++,
            request_seq: request.seq,
            command: request.command,
            success: false,
            message: format
        } as any);
    }

    private sendEvent(event: string, body?: any) {
        this._onDidSendMessage.fire({
            type: 'event',
            seq: this.seq++,
            event,
            body
        } as any);
    }

    dispose() {
        // Cleanup
    }
}
