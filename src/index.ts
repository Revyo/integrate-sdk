/**
 * Integrate SDK
 * Type-safe TypeScript SDK for MCP Client
 */

// Core client
export { MCPClient, createMCPClient } from "./client.js";
export type { ToolInvocationOptions } from "./client.js";

// Configuration
export type { MCPClientConfig, ReauthContext, ReauthHandler } from "./config/types.js";

// Errors
export {
  IntegrateSDKError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  ConnectionError,
  ToolCallError,
  isAuthError,
  isTokenExpiredError,
  isAuthorizationError,
  parseServerError,
} from "./errors.js";

// Plugin system
export type {
  MCPPlugin,
  OAuthConfig,
  ExtractPluginIds,
  ExtractPluginTools,
} from "./plugins/types.js";

// Built-in plugins
export { githubPlugin } from "./plugins/github.js";
export type { GitHubPluginConfig, GitHubTools, GitHubPluginClient } from "./plugins/github.js";

export { gmailPlugin } from "./plugins/gmail.js";
export type { GmailPluginConfig, GmailTools, GmailPluginClient } from "./plugins/gmail.js";

// Server client
export type { ServerPluginClient } from "./plugins/server-client.js";

export {
  genericOAuthPlugin,
  createSimplePlugin,
} from "./plugins/generic.js";
export type { GenericOAuthPluginConfig } from "./plugins/generic.js";

// Integrations
export {
  convertMCPToolToVercelAI,
  convertMCPToolsToVercelAI,
  getVercelAITools,
} from "./integrations/vercel-ai.js";
export type { VercelAITool } from "./integrations/vercel-ai.js";

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

