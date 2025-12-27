import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { WebSocketManager } from '../connection/WebSocketManager';
import {
    PlaceInfo,
    ScanScriptsResult,
    GetRemotesResult,
    ScanConstantsResult,
    ScanUpvaluesResult,
    SearchConstantsParams,
    SearchUpvaluesParams
} from '../types/protocol';

export class McpServer {
    private server: Server;
    private rpc: JsonRpcHandler;
    private wsManager: WebSocketManager;
    private isRunning = false;

    constructor() {
        this.rpc = JsonRpcHandler.getInstance();
        this.wsManager = WebSocketManager.getInstance();

        this.server = new Server(
            {
                name: 'exploitor-mcp',
                version: '0.1.0'
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );

        this.setupHandlers();
    }

    private setupHandlers(): void {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_place_info',
                    description: 'Get information about the current Roblox place (PlaceId, creator, etc)',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                },
                {
                    name: 'get_scripts',
                    description: 'Get a list of all scripts in the game',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                },
                {
                    name: 'get_remotes',
                    description: 'Get a list of all RemoteEvents and RemoteFunctions',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                },
                {
                    name: 'search_constants',
                    description: 'Search for constants by value or pattern',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query for constant values'
                            },
                            type: {
                                type: 'string',
                                description: 'Filter by type (string, number, etc)',
                                enum: ['string', 'number', 'boolean']
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_upvalues',
                    description: 'Search for upvalues by name or value',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query for upvalue names or values'
                            },
                            type: {
                                type: 'string',
                                description: 'Filter by type',
                                enum: ['string', 'number', 'boolean', 'function', 'table']
                            }
                        },
                        required: ['query']
                    }
                }
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (!this.wsManager.isConnected()) {
                return {
                    content: [{ type: 'text', text: 'Error: Not connected to executor' }],
                    isError: true
                };
            }

            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'get_place_info': {
                        const result = await this.rpc.request<PlaceInfo>('get_place_info');
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }]
                        };
                    }

                    case 'get_scripts': {
                        const result = await this.rpc.request<ScanScriptsResult>('scan_scripts');
                        const summary = result.scripts.map(s => ({
                            name: s.name,
                            path: s.path,
                            protosCount: s.protosCount,
                            constantsCount: s.constantsCount
                        }));
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(summary, null, 2)
                            }]
                        };
                    }

                    case 'get_remotes': {
                        const result = await this.rpc.request<GetRemotesResult>('get_remotes');
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(result.remotes, null, 2)
                            }]
                        };
                    }

                    case 'search_constants': {
                        const params = args as unknown as SearchConstantsParams;
                        const result = await this.rpc.request<ScanConstantsResult>('scan_constants');
                        const filtered = result.constants.filter(c => {
                            const matchesQuery = c.value.toLowerCase().includes(params.query.toLowerCase());
                            const matchesType = !params.type || c.type === params.type;
                            return matchesQuery && matchesType;
                        });
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(filtered.slice(0, 100), null, 2)
                            }]
                        };
                    }

                    case 'search_upvalues': {
                        const params = args as unknown as SearchUpvaluesParams;
                        const result = await this.rpc.request<ScanUpvaluesResult>('scan_upvalues');
                        const filtered = result.upvalues.filter(u => {
                            const matchesQuery = 
                                u.name.toLowerCase().includes(params.query.toLowerCase()) ||
                                u.value.toLowerCase().includes(params.query.toLowerCase());
                            const matchesType = !params.type || u.type === params.type;
                            return matchesQuery && matchesType;
                        });
                        return {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(filtered.slice(0, 100), null, 2)
                            }]
                        };
                    }

                    default:
                        return {
                            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                            isError: true
                        };
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`
                    }],
                    isError: true
                };
            }
        });
    }

    public async start(): Promise<void> {
        if (this.isRunning) return;

        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.isRunning = true;
    }

    public async stop(): Promise<void> {
        if (!this.isRunning) return;

        await this.server.close();
        this.isRunning = false;
    }

    public isActive(): boolean {
        return this.isRunning;
    }
}
