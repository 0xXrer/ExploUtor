import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { JsonRpcHandler } from '../connection/JsonRpcHandler';
import { WebSocketManager } from '../connection/WebSocketManager';
import { PlaceInfo, GetRemotesResult } from '../types/protocol';

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
                    inputSchema: { type: 'object', properties: {}, required: [] }
                },
                {
                    name: 'find_instances',
                    description: 'Find instances by name pattern or ClassName',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Name or pattern to search for' },
                            className: { type: 'string', description: 'Filter by ClassName (e.g., Part, Model, Script)' },
                            ancestor: { type: 'string', description: 'Path to search under (default: game)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'get_children',
                    description: 'Get children of an instance',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Full path to the instance (default: game)' }
                        },
                        required: []
                    }
                },
                {
                    name: 'get_properties',
                    description: 'Get properties and attributes of an instance',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Full path to the instance' },
                            properties: { type: 'array', items: { type: 'string' }, description: 'Specific property names to fetch' }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'read_script',
                    description: 'Read/decompile the source code of a script',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            path: { type: 'string', description: 'Full path to the script' }
                        },
                        required: ['path']
                    }
                },
                {
                    name: 'get_remotes',
                    description: 'Get a list of all RemoteEvents and RemoteFunctions',
                    inputSchema: { type: 'object', properties: {}, required: [] }
                },
                {
                    name: 'search_upvalues',
                    description: 'Search for upvalues by name or value pattern',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query for upvalue names or values' },
                            type: { type: 'string', description: 'Filter by type', enum: ['string', 'number', 'boolean', 'function', 'table'] }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_constants',
                    description: 'Search for constants by value pattern',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query for constant values' },
                            type: { type: 'string', description: 'Filter by type', enum: ['string', 'number', 'boolean'] }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_scripts',
                    description: 'Search for scripts by name pattern',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Script name pattern to search for' },
                            includeModules: { type: 'boolean', description: 'Include ModuleScripts (default: true)' }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'search_closures',
                    description: 'Search for closures by name or constants',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Closure name or constant to search for' },
                            searchConstants: { type: 'boolean', description: 'Search in constants too' }
                        },
                        required: ['query']
                    }
                }
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (!this.wsManager.isConnected()) {
                return { content: [{ type: 'text', text: 'Error: Not connected to executor' }], isError: true };
            }

            const { name, arguments: args } = request.params;

            try {
                const result = await this.rpc.request(name, args || {});
                return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
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
