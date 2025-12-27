import * as vscode from 'vscode';
import { WebSocketManager } from './WebSocketManager';
import { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification } from '../types/protocol';

type NotificationHandler = (params: unknown) => void;

export class JsonRpcHandler {
    private static instance: JsonRpcHandler;
    private wsManager: WebSocketManager;
    private requestId = 0;
    private pendingRequests = new Map<number | string, {
        resolve: (result: unknown) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>();
    private notificationHandlers = new Map<string, NotificationHandler[]>();
    private disposable: vscode.Disposable;

    private constructor() {
        this.wsManager = WebSocketManager.getInstance();
        this.disposable = this.wsManager.onMessage(this.handleMessage.bind(this));
    }

    public static getInstance(): JsonRpcHandler {
        if (!JsonRpcHandler.instance) {
            JsonRpcHandler.instance = new JsonRpcHandler();
        }
        return JsonRpcHandler.instance;
    }

    public async request<T>(method: string, params?: unknown, timeout = 30000): Promise<T> {
        if (!this.wsManager.isConnected()) {
            throw new Error('Not connected to executor');
        }

        const id = ++this.requestId;
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise<T>((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, timeout);

            this.pendingRequests.set(id, {
                resolve: resolve as (result: unknown) => void,
                reject,
                timeout: timeoutHandle
            });

            const sent = this.wsManager.send(JSON.stringify(request));
            if (!sent) {
                clearTimeout(timeoutHandle);
                this.pendingRequests.delete(id);
                reject(new Error('Failed to send request'));
            }
        });
    }

    public notify(method: string, params?: unknown): void {
        if (!this.wsManager.isConnected()) {
            return;
        }

        const notification: JsonRpcNotification = {
            jsonrpc: '2.0',
            method,
            params
        };

        this.wsManager.send(JSON.stringify(notification));
    }

    public onNotification(method: string, handler: NotificationHandler): vscode.Disposable {
        const handlers = this.notificationHandlers.get(method) || [];
        handlers.push(handler);
        this.notificationHandlers.set(method, handlers);

        return new vscode.Disposable(() => {
            const currentHandlers = this.notificationHandlers.get(method) || [];
            const index = currentHandlers.indexOf(handler);
            if (index !== -1) {
                currentHandlers.splice(index, 1);
            }
        });
    }

    private handleMessage(message: string): void {
        try {
            const data = JSON.parse(message);
            
            if ('id' in data && data.id !== null) {
                this.handleResponse(data as JsonRpcResponse);
            } else if ('method' in data) {
                this.handleNotification(data as JsonRpcNotification);
            }
        } catch (error) {
            console.error('Failed to parse JSON-RPC message:', error);
        }
    }

    private handleResponse(response: JsonRpcResponse): void {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
            pending.reject(new Error(response.error.message));
        } else {
            pending.resolve(response.result);
        }
    }

    private handleNotification(notification: JsonRpcNotification): void {
        const handlers = this.notificationHandlers.get(notification.method) || [];
        for (const handler of handlers) {
            try {
                handler(notification.params);
            } catch (error) {
                console.error(`Error in notification handler for ${notification.method}:`, error);
            }
        }
    }

    public dispose(): void {
        this.disposable.dispose();
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Handler disposed'));
        }
        this.pendingRequests.clear();
        this.notificationHandlers.clear();
    }
}
