import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from '../core/websocket';
import { OutputChannelManager } from '../ui/outputChannel';

export class MemoryViewer {
    private panel?: vscode.WebviewPanel;

    constructor(
        private readonly wsManager: WebSocketManager,
        private readonly outputManager: OutputChannelManager
    ) {
        this.wsManager.onMessage(this.handleMessage.bind(this));
    }

    public open() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'exploUtorMemory',
            'Memory Viewer',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtmlContent();

        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'readMemory':
                    this.wsManager.send({
                        type: 'memory_update',
                        address: parseInt(message.address, 16),
                        // size: message.size
                    });
                    break;
                case 'writeMemory':
                    // Implement write logic
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private handleMessage(message: ExecutorMessage) {
        if (message.type === 'memory_update' && this.panel) {
            this.panel.webview.postMessage({
                command: 'updateMemory',
                address: message.address,
                data: message.data
            });
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Memory Viewer</title>
    <style>
        body { font-family: monospace; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; }
        .controls { margin-bottom: 20px; }
        input { background: #3c3c3c; border: 1px solid #555; color: #fff; padding: 5px; }
        button { background: #0e639c; color: #fff; border: none; padding: 5px 10px; cursor: pointer; }
        button:hover { background: #1177bb; }
        #memory-grid { display: grid; grid-template-columns: 100px repeat(16, 1fr); gap: 5px; }
        .header { font-weight: bold; color: #569cd6; }
        .cell { padding: 2px; text-align: center; }
        .cell:hover { background-color: #2a2d2e; }
    </style>
</head>
<body>
    <div class="controls">
        <input type="text" id="addressInput" placeholder="Address (Hex)" value="0x00000000">
        <button onclick="readMemory()">Read</button>
    </div>
    <div id="memory-grid">
        <!-- Headers -->
        <div class="header">Address</div>
        <div class="header">00</div><div class="header">01</div><div class="header">02</div><div class="header">03</div>
        <div class="header">04</div><div class="header">05</div><div class="header">06</div><div class="header">07</div>
        <div class="header">08</div><div class="header">09</div><div class="header">0A</div><div class="header">0B</div>
        <div class="header">0C</div><div class="header">0D</div><div class="header">0E</div><div class="header">0F</div>
        <!-- Content will be injected here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function readMemory() {
            const address = document.getElementById('addressInput').value;
            vscode.postMessage({
                command: 'readMemory',
                address: address
            });
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateMemory') {
                // Update grid with data
                // Implementation omitted for brevity
                console.log('Received memory data:', message);
            }
        });
    </script>
</body>
</html>`;
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
    }
}
