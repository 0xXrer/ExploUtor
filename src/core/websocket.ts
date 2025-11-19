import * as vscode from 'vscode';
import { WebSocket, WebSocketServer } from 'ws';

export enum ConnectionStatus {
    Connected = 'connected',
    Disconnected = 'disconnected',
    Listening = 'listening',
    Error = 'error'
}

export interface ExecutorMessage {
    type: 'execute' | 'bundle_execute' | 'heartbeat' | 'response' | 'debug_event' | 'memory_update' | 'profiler_data';
    code?: string;
    bundled?: boolean;
    selection?: boolean;
    success?: boolean;
    error?: string;
    output?: string;
    // Debug fields
    debugType?: 'breakpoint' | 'step' | 'pause' | 'variables';
    threadId?: number;
    stackFrameId?: number;
    variables?: Record<string, any>;
    // Memory fields
    address?: number;
    data?: string; // Hex string or base64
    // Profiler fields
    profileData?: any;
}

export class WebSocketManager {
    private wss?: WebSocketServer;
    private activeSocket?: WebSocket;
    private _status: ConnectionStatus = ConnectionStatus.Disconnected;
    private _onStatusChange = new vscode.EventEmitter<ConnectionStatus>();
    private _onMessage = new vscode.EventEmitter<ExecutorMessage>();

    public readonly onStatusChange = this._onStatusChange.event;
    public readonly onMessage = this._onMessage.event;

    constructor(
        private readonly outputChannel: vscode.OutputChannel
    ) { }

    public get status(): ConnectionStatus {
        return this._status;
    }

    private setStatus(status: ConnectionStatus) {
        if (this._status !== status) {
            this._status = status;
            this._onStatusChange.fire(status);
            this.outputChannel.appendLine(`[WebSocket] Status: ${status}`);
        }
    }

    public async startServer(port: number): Promise<void> {
        if (this.wss) {
            this.outputChannel.appendLine('[WebSocket] Server already running');
            return;
        }

        try {
            this.wss = new WebSocketServer({ port });
            this.setStatus(ConnectionStatus.Listening);
            this.outputChannel.appendLine(`[WebSocket] Server listening on port ${port}`);

            this.wss.on('connection', (ws: WebSocket) => {
                this.handleConnection(ws);
            });

            this.wss.on('error', (err) => {
                this.outputChannel.appendLine(`[WebSocket] Server error: ${err.message}`);
                this.setStatus(ConnectionStatus.Error);
            });

            this.wss.on('close', () => {
                this.outputChannel.appendLine('[WebSocket] Server closed');
                this.setStatus(ConnectionStatus.Disconnected);
            });

        } catch (err) {
            this.outputChannel.appendLine(`[WebSocket] Failed to start server: ${err}`);
            this.setStatus(ConnectionStatus.Error);
            throw err;
        }
    }

    private handleConnection(ws: WebSocket) {
        this.outputChannel.appendLine('[WebSocket] Client connected');
        this.activeSocket = ws;
        this.setStatus(ConnectionStatus.Connected);

        ws.on('message', (data: Buffer) => {
            try {
                const message: ExecutorMessage = JSON.parse(data.toString());
                // Filter out heartbeats to avoid log spam
                if (message.type !== 'heartbeat') {
                    this.outputChannel.appendLine(`[WebSocket] Received: ${JSON.stringify(message)}`);
                }
                this._onMessage.fire(message);
            } catch (err) {
                this.outputChannel.appendLine(`[WebSocket] Failed to parse message: ${err}`);
            }
        });

        ws.on('close', () => {
            this.outputChannel.appendLine('[WebSocket] Client disconnected');
            if (this.activeSocket === ws) {
                this.activeSocket = undefined;
                this.setStatus(ConnectionStatus.Listening);
            }
        });

        ws.on('error', (err) => {
            this.outputChannel.appendLine(`[WebSocket] Client error: ${err.message}`);
        });
    }

    public stopServer(): void {
        if (this.wss) {
            this.wss.close();
            this.wss = undefined;
        }
        if (this.activeSocket) {
            this.activeSocket.terminate();
            this.activeSocket = undefined;
        }
        this.setStatus(ConnectionStatus.Disconnected);
    }

    public async send(message: ExecutorMessage): Promise<void> {
        if (!this.activeSocket || this.activeSocket.readyState !== WebSocket.OPEN) {
            throw new Error('No active client connection');
        }

        return new Promise((resolve, reject) => {
            const data = JSON.stringify(message);
            this.outputChannel.appendLine(`[WebSocket] Sending: ${data}`);

            this.activeSocket!.send(data, (err) => {
                if (err) {
                    this.outputChannel.appendLine(`[WebSocket] Send failed: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public dispose(): void {
        this.stopServer();
        this._onStatusChange.dispose();
        this._onMessage.dispose();
    }
}
