import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from './websocket';

export interface Plugin {
    id: string;
    name: string;
    onActivate: (context: PluginContext) => void;
    onDeactivate?: () => void;
}

export interface PluginContext {
    registerCommand: (command: string, callback: (...args: any[]) => any) => vscode.Disposable;
    onMessage: (type: string, callback: (message: ExecutorMessage) => void) => vscode.Disposable;
    sendToExecutor: (message: ExecutorMessage) => Promise<void>;
}

export class PluginSystem {
    private plugins: Map<string, Plugin> = new Map();
    private messageListeners: Map<string, ((message: ExecutorMessage) => void)[]> = new Map();

    constructor(
        private readonly wsManager: WebSocketManager,
        private readonly context: vscode.ExtensionContext
    ) {
        this.wsManager.onMessage(this.handleMessage.bind(this));
    }

    public registerPlugin(plugin: Plugin) {
        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin ${plugin.id} is already registered`);
        }

        const pluginContext: PluginContext = {
            registerCommand: (command, callback) => {
                return vscode.commands.registerCommand(command, callback);
            },
            onMessage: (type, callback) => {
                if (!this.messageListeners.has(type)) {
                    this.messageListeners.set(type, []);
                }
                this.messageListeners.get(type)!.push(callback);
                return {
                    dispose: () => {
                        const listeners = this.messageListeners.get(type);
                        if (listeners) {
                            const index = listeners.indexOf(callback);
                            if (index > -1) {
                                listeners.splice(index, 1);
                            }
                        }
                    }
                };
            },
            sendToExecutor: async (message) => {
                await this.wsManager.send(message);
            }
        };

        plugin.onActivate(pluginContext);
        this.plugins.set(plugin.id, plugin);
        console.log(`Plugin ${plugin.name} (${plugin.id}) activated`);
    }

    private handleMessage(message: ExecutorMessage) {
        const listeners = this.messageListeners.get(message.type);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(message);
                } catch (err) {
                    console.error(`Error in plugin listener for ${message.type}:`, err);
                }
            });
        }
    }

    public dispose() {
        this.plugins.forEach(plugin => {
            if (plugin.onDeactivate) {
                plugin.onDeactivate();
            }
        });
        this.plugins.clear();
        this.messageListeners.clear();
    }
}
