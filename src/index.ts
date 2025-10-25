/**
 * Integrate SDK
 * Type-safe TypeScript SDK for MCP Client
 */

// Core client
export { MCPClient, createMCPClient } from "./client.js";
export type { ToolInvocationOptions } from "./client.js";

// Configuration
export type { MCPClientConfig } from "./config/types.js";

// Plugin system
export type {
  MCPPlugin,
  OAuthConfig,
  ExtractPluginIds,
  ExtractPluginTools,
} from "./plugins/types.js";

// Built-in plugins
export { githubPlugin } from "./plugins/github.js";
export type { GitHubPluginConfig, GitHubTools } from "./plugins/github.js";

export { gmailPlugin } from "./plugins/gmail.js";
export type { GmailPluginConfig, GmailTools } from "./plugins/gmail.js";

export {
  genericOAuthPlugin,
  createSimplePlugin,
} from "./plugins/generic.js";
export type { GenericOAuthPluginConfig } from "./plugins/generic.js";

// Protocol types
export type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCSuccessResponse,
  JSONRPCErrorResponse,
  JSONRPCNotification,
  MCPTool,
  MCPToolsListResponse,
  MCPToolCallParams,
  MCPToolCallResponse,
  MCPInitializeParams,
  MCPInitializeResponse,
} from "./protocol/messages.js";

export { MCPMethod } from "./protocol/messages.js";

// Transport
export { HttpSessionTransport } from "./transport/http-session.js";
export type {
  MessageHandler,
  HttpSessionTransportOptions,
} from "./transport/http-session.js";

