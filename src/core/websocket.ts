import * as vscode from 'vscode';
import WebSocket from 'ws';

export enum ConnectionStatus {
    Connected = 'connected',
    Disconnected = 'disconnected',
    Connecting = 'connecting',
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
    private ws?: WebSocket;
    private reconnectTimer?: NodeJS.Timeout;
    private heartbeatTimer?: NodeJS.Timeout;
    private readonly reconnectInterval = 5000;
    private readonly heartbeatInterval = 30000;

    private _status: ConnectionStatus = ConnectionStatus.Disconnected;
    private _onStatusChange = new vscode.EventEmitter<ConnectionStatus>();
    private _onMessage = new vscode.EventEmitter<ExecutorMessage>();

    public readonly onStatusChange = this._onStatusChange.event;
    public readonly onMessage = this._onMessage.event;

    constructor(
        private readonly outputChannel: vscode.OutputChannel
    ) {}

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

    public async connect(host: string, port: number): Promise<void> {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.outputChannel.appendLine('[WebSocket] Already connected');
            return;
        }

        this.setStatus(ConnectionStatus.Connecting);
        const url = `ws://${host}:${port}`;
        this.outputChannel.appendLine(`[WebSocket] Connecting to ${url}...`);

        try {
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                this.setStatus(ConnectionStatus.Connected);
                this.outputChannel.appendLine('[WebSocket] Connected successfully');
                this.startHeartbeat();
                this.stopReconnect();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message: ExecutorMessage = JSON.parse(data.toString());
                    this.outputChannel.appendLine(`[WebSocket] Received: ${JSON.stringify(message)}`);
                    this._onMessage.fire(message);
                } catch (err) {
                    this.outputChannel.appendLine(`[WebSocket] Failed to parse message: ${err}`);
                }
            });

            this.ws.on('error', (err) => {
                this.outputChannel.appendLine(`[WebSocket] Error: ${err.message}`);
                this.setStatus(ConnectionStatus.Error);
            });

            this.ws.on('close', () => {
                this.outputChannel.appendLine('[WebSocket] Connection closed');
                this.setStatus(ConnectionStatus.Disconnected);
                this.stopHeartbeat();
                this.startReconnect(host, port);
            });

        } catch (err) {
            this.outputChannel.appendLine(`[WebSocket] Connection failed: ${err}`);
            this.setStatus(ConnectionStatus.Error);
            throw err;
        }
    }

    public disconnect(): void {
        this.stopReconnect();
        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = undefined;
        }

        this.setStatus(ConnectionStatus.Disconnected);
    }

    public async send(message: ExecutorMessage): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }

        return new Promise((resolve, reject) => {
            const data = JSON.stringify(message);
            this.outputChannel.appendLine(`[WebSocket] Sending: ${data}`);

            this.ws!.send(data, (err) => {
                if (err) {
                    this.outputChannel.appendLine(`[WebSocket] Send failed: ${err.message}`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'heartbeat' }).catch(() => {
                    this.outputChannel.appendLine('[WebSocket] Heartbeat failed');
                });
            }
        }, this.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    private startReconnect(host: string, port: number): void {
        this.stopReconnect();
        this.reconnectTimer = setTimeout(() => {
            this.outputChannel.appendLine('[WebSocket] Attempting to reconnect...');
            this.connect(host, port).catch(() => {
                // Reconnect will be attempted again on close event
            });
        }, this.reconnectInterval);
    }

    private stopReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    public dispose(): void {
        this.disconnect();
        this._onStatusChange.dispose();
        this._onMessage.dispose();
    }
}
