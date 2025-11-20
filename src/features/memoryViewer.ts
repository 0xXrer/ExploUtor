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
                        type: 'memory_read',
                        address: parseInt(message.address, 16),
                        size: message.size || 256
                    });
                    break;
                case 'writeMemory':
                    // Implement write logic if supported
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
                data: message.data // Expecting base64 or array of bytes
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
        body { font-family: 'Consolas', 'Courier New', monospace; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; font-size: 13px; }
        .controls { margin-bottom: 15px; display: flex; gap: 10px; align-items: center; background: #252526; padding: 10px; border-radius: 4px; }
        input { background: #3c3c3c; border: 1px solid #555; color: #fff; padding: 5px; font-family: inherit; }
        button { background: #0e639c; color: #fff; border: none; padding: 6px 12px; cursor: pointer; border-radius: 2px; }
        button:hover { background: #1177bb; }
        .toggle { display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }
        
        #memory-container { 
            display: grid; 
            grid-template-columns: auto 1fr auto; /* Addr, Hex, Ascii */
            gap: 10px;
            background: #1e1e1e;
        }
        
        .addr-col { color: #569cd6; text-align: right; padding-right: 10px; border-right: 1px solid #333; }
        .hex-col { color: #d4d4d4; word-spacing: 4px; }
        .ascii-col { color: #ce9178; padding-left: 10px; border-left: 1px solid #333; }
        
        .row { height: 20px; line-height: 20px; }
        .byte { display: inline-block; width: 20px; text-align: center; }
        .byte:hover { background-color: #264f78; cursor: default; }
        
        .ascii-char { display: inline-block; width: 10px; text-align: center; }
    </style>
</head>
<body>
    <div class="controls">
        <input type="text" id="addressInput" placeholder="Address (Hex)" value="0x00000000">
        <button onclick="readMemory()">Read</button>
        <label class="toggle">
            <input type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()"> Auto-Refresh
        </label>
        <span id="status" style="margin-left: auto; color: #888;">Ready</span>
    </div>
    
    <div id="memory-container">
        <div id="addr-view" class="addr-col"></div>
        <div id="hex-view" class="hex-col"></div>
        <div id="ascii-view" class="ascii-col"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let refreshInterval;
        
        function readMemory() {
            const address = document.getElementById('addressInput').value;
            vscode.postMessage({
                command: 'readMemory',
                address: address,
                size: 256
            });
            document.getElementById('status').innerText = 'Reading...';
        }

        function toggleAutoRefresh() {
            const cb = document.getElementById('autoRefresh');
            if (cb.checked) {
                readMemory();
                refreshInterval = setInterval(readMemory, 1000);
            } else {
                clearInterval(refreshInterval);
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateMemory') {
                renderMemory(message.address, message.data);
                document.getElementById('status').innerText = 'Updated: ' + new Date().toLocaleTimeString();
            }
        });

        function renderMemory(startAddress, data) {
            // Data is expected to be an array of numbers (bytes)
            // If it comes as base64, we'd need to decode it. Assuming array for now.
            
            const addrView = document.getElementById('addr-view');
            const hexView = document.getElementById('hex-view');
            const asciiView = document.getElementById('ascii-view');
            
            addrView.innerHTML = '';
            hexView.innerHTML = '';
            asciiView.innerHTML = '';
            
            const bytesPerRow = 16;
            const rows = Math.ceil(data.length / bytesPerRow);
            
            for (let r = 0; r < rows; r++) {
                const rowAddr = startAddress + (r * bytesPerRow);
                const rowBytes = data.slice(r * bytesPerRow, (r + 1) * bytesPerRow);
                
                // Address
                const addrDiv = document.createElement('div');
                addrDiv.className = 'row';
                addrDiv.innerText = '0x' + rowAddr.toString(16).padStart(8, '0').toUpperCase();
                addrView.appendChild(addrDiv);
                
                // Hex
                const hexDiv = document.createElement('div');
                hexDiv.className = 'row';
                let hexHtml = '';
                for (let i = 0; i < bytesPerRow; i++) {
                    if (i < rowBytes.length) {
                        const b = rowBytes[i];
                        hexHtml += \`<span class="byte">\${b.toString(16).padStart(2, '0').toUpperCase()}</span> \`;
                    } else {
                        hexHtml += '<span class="byte">  </span> ';
                    }
                }
                hexDiv.innerHTML = hexHtml;
                hexView.appendChild(hexDiv);
                
                // Ascii
                const asciiDiv = document.createElement('div');
                asciiDiv.className = 'row';
                let asciiHtml = '';
                for (let i = 0; i < bytesPerRow; i++) {
                    if (i < rowBytes.length) {
                        const b = rowBytes[i];
                        const char = (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                        asciiHtml += \`<span class="ascii-char">\${char}</span>\`;
                    } else {
                        asciiHtml += '<span class="ascii-char"> </span>';
                    }
                }
                asciiDiv.innerHTML = asciiHtml;
                asciiView.appendChild(asciiDiv);
            }
        }
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
