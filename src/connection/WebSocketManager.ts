import * as vscode from 'vscode';
import WebSocket from 'ws';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class WebSocketManager {
    private static instance: WebSocketManager;
    private ws: WebSocket | null = null;
    private state: ConnectionState = 'disconnected';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000;
    private reconnectTimer: NodeJS.Timeout | null = null;
    
    private readonly onMessageEmitter = new vscode.EventEmitter<string>();
    private readonly onStateChangeEmitter = new vscode.EventEmitter<ConnectionState>();
    
    public readonly onMessage = this.onMessageEmitter.event;
    public readonly onStateChange = this.onStateChangeEmitter.event;

    private constructor() {}

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    public getState(): ConnectionState {
        return this.state;
    }

    public async connect(): Promise<void> {
        if (this.state === 'connected' || this.state === 'connecting') {
            return;
        }

        const config = vscode.workspace.getConfiguration('exploitor');
        const host = config.get<string>('websocket.host', 'localhost');
        const port = config.get<number>('websocket.port', 8080);
        const url = `ws://${host}:${port}`;

        this.setState('connecting');

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);

                this.ws.on('open', () => {
                    this.setState('connected');
                    this.reconnectAttempts = 0;
                    resolve();
                });

                this.ws.on('message', (data: WebSocket.Data) => {
                    const message = data.toString();
                    this.onMessageEmitter.fire(message);
                });

                this.ws.on('close', () => {
                    this.handleDisconnect();
                });

                this.ws.on('error', (error: Error) => {
                    if (this.state === 'connecting') {
                        reject(error);
                    }
                    this.handleDisconnect();
                });
            } catch (error) {
                this.setState('disconnected');
                reject(error);
            }
        });
    }

    public disconnect(): void {
        this.cancelReconnect();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setState('disconnected');
    }

    public send(message: string): boolean {
        if (this.ws && this.state === 'connected') {
            this.ws.send(message);
            return true;
        }
        return false;
    }

    public isConnected(): boolean {
        return this.state === 'connected';
    }

    private setState(state: ConnectionState): void {
        if (this.state !== state) {
            this.state = state;
            this.onStateChangeEmitter.fire(state);
        }
    }

    private handleDisconnect(): void {
        if (this.state === 'disconnected') {
            return;
        }
        
        this.ws = null;
        this.setState('disconnected');

        const config = vscode.workspace.getConfiguration('exploitor');
        const autoConnect = config.get<boolean>('autoConnect', true);

        if (autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        this.cancelReconnect();
        
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
            30000
        );

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectAttempts++;
            try {
                await this.connect();
            } catch {
                // Connection failed, will retry via handleDisconnect
            }
        }, delay);
    }

    private cancelReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    public dispose(): void {
        this.disconnect();
        this.onMessageEmitter.dispose();
        this.onStateChangeEmitter.dispose();
    }
}
