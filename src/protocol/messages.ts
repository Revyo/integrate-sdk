/**
 * MCP Protocol Message Types
 * Based on JSON-RPC 2.0 specification with MCP extensions
 */

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

/**
 * JSON-RPC 2.0 Response (Success)
 */
export interface JSONRPCSuccessResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

/**
 * JSON-RPC 2.0 Response (Error)
 */
export interface JSONRPCErrorResponse {
  jsonrpc: "2.0";
  id: string | number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * JSON-RPC 2.0 Notification (no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
}

/**
 * Union type for any JSON-RPC response
 */
export type JSONRPCResponse<T = unknown> =
  | JSONRPCSuccessResponse<T>
  | JSONRPCErrorResponse;

/**
 * MCP Tool Definition
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * MCP Tools List Response
 */
export interface MCPToolsListResponse {
  tools: MCPTool[];
}

/**
 * MCP Tool Call Request Parameters
 */
export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP Tool Call Response
 */
export interface MCPToolCallResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

/**
 * MCP Protocol Methods
 */
export enum MCPMethod {
  INITIALIZE = "initialize",
  TOOLS_LIST = "tools/list",
  TOOLS_CALL = "tools/call",
  RESOURCES_LIST = "resources/list",
  RESOURCES_READ = "resources/read",
  PROMPTS_LIST = "prompts/list",
  PROMPTS_GET = "prompts/get",
}

/**
 * Initialize request parameters
 */
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
    [key: string]: unknown;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * Initialize response
 */
export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
    [key: string]: unknown;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

