import * as vscode from 'vscode';
import { WebSocketManager, ExecutorMessage } from '../core/websocket';
import { OutputChannelManager } from '../ui/outputChannel';

export class Profiler {
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
            'exploUtorProfiler',
            'Performance Profiler',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtmlContent();

        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'startProfiling':
                    this.wsManager.send({
                        type: 'execute',
                        code: 'debug.sethook(profiler_hook, "crl")' // Hypothetical hook
                    });
                    break;
                case 'stopProfiling':
                    this.wsManager.send({
                        type: 'execute',
                        code: 'debug.sethook()'
                    });
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private handleMessage(message: ExecutorMessage) {
        if (message.type === 'profiler_data' && this.panel) {
            this.panel.webview.postMessage({
                command: 'updateProfiler',
                data: message.profileData
            });
        }
    }

    private getHtmlContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Profiler</title>
    <style>
        body { font-family: sans-serif; padding: 10px; background-color: #1e1e1e; color: #d4d4d4; }
        .controls { margin-bottom: 20px; }
        button { background: #0e639c; color: #fff; border: none; padding: 5px 10px; cursor: pointer; margin-right: 10px; }
        button:hover { background: #1177bb; }
        button.stop { background: #a51d2d; }
        button.stop:hover { background: #be1100; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
        th { background-color: #252526; }
        tr:hover { background-color: #2a2d2e; }
    </style>
</head>
<body>
    <div class="controls">
        <button onclick="startProfiling()">Start Profiling</button>
        <button class="stop" onclick="stopProfiling()">Stop Profiling</button>
        <button onclick="clearData()">Clear</button>
    </div>
    <table id="profiler-table">
        <thead>
            <tr>
                <th>Function</th>
                <th>Source</th>
                <th>Calls</th>
                <th>Time (ms)</th>
                <th>Avg (ms)</th>
            </tr>
        </thead>
        <tbody id="profiler-body">
            <!-- Data will be injected here -->
        </tbody>
    </table>

    <script>
        const vscode = acquireVsCodeApi();
        
        function startProfiling() {
            vscode.postMessage({ command: 'startProfiling' });
        }

        function stopProfiling() {
            vscode.postMessage({ command: 'stopProfiling' });
        }

        function clearData() {
            document.getElementById('profiler-body').innerHTML = '';
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateProfiler') {
                const tbody = document.getElementById('profiler-body');
                // Assuming message.data is an array of profile entries
                // Implementation omitted for brevity
                console.log('Received profiler data:', message.data);
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
