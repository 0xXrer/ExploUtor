export interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number | string;
    result?: unknown;
    error?: JsonRpcError;
}

export interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params?: unknown;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

export interface PlaceInfo {
    placeId: number;
    placeName: string;
    creatorId: number;
    creatorName: string;
    creatorType: string;
    maxPlayers: number;
    serverSize: number;
}

export interface UpvalueInfo {
    id: string;
    closureId: string;
    closureName: string;
    closureLocation: string;
    index: number;
    name: string;
    value: string;
    type: string;
}

export interface ConstantInfo {
    id: string;
    closureId: string;
    closureName: string;
    closureLocation: string;
    index: number;
    value: string;
    type: string;
}

export interface ScriptInfo {
    id: string;
    name: string;
    path: string;
    className: string;
    source: string;
    protosCount: number;
    constantsCount: number;
    upvaluesCount: number;
}

export interface ModuleInfo extends ScriptInfo {
    returnValue: string;
    returnType: string;
}

export interface ClosureInfo {
    id: string;
    name: string;
    location: string;
    source: string;
    protosCount: number;
    constantsCount: number;
    upvaluesCount: number;
    constants: ConstantInfo[];
    upvalues: UpvalueInfo[];
}

export interface RemoteCallInfo {
    id: string;
    timestamp: number;
    remoteName: string;
    remotePath: string;
    remoteType: 'RemoteEvent' | 'RemoteFunction' | 'BindableEvent' | 'BindableFunction';
    arguments: string;
    caller: string;
    traceback: string;
}

export interface ClosureCallInfo {
    id: string;
    timestamp: number;
    closureName: string;
    closureLocation: string;
    arguments: string;
    traceback: string;
}

export interface RemoteInfo {
    name: string;
    path: string;
    type: 'RemoteEvent' | 'RemoteFunction';
}

export type InspectorItem = 
    | { type: 'upvalue'; data: UpvalueInfo }
    | { type: 'constant'; data: ConstantInfo }
    | { type: 'script'; data: ScriptInfo }
    | { type: 'module'; data: ModuleInfo }
    | { type: 'closure'; data: ClosureInfo };

export interface ScanUpvaluesResult {
    upvalues: UpvalueInfo[];
}

export interface ScanConstantsResult {
    constants: ConstantInfo[];
}

export interface ScanScriptsResult {
    scripts: ScriptInfo[];
}

export interface ScanModulesResult {
    modules: ModuleInfo[];
}

export interface GetRemotesResult {
    remotes: RemoteInfo[];
}

export interface ExecuteResult {
    success: boolean;
    output?: string;
    error?: string;
}

export interface ModifyUpvalueParams {
    closureId: string;
    upvalueIndex: number;
    value: string;
    valueType: string;
}

export interface SearchConstantsParams {
    query: string;
    type?: string;
}

export interface SearchUpvaluesParams {
    query: string;
    type?: string;
}
