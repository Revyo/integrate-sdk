/**
 * Integrate SDK
 * Type-safe TypeScript SDK for MCP Client
 */

// Core client
export { MCPClient, createMCPClient, clearClientCache } from "./client.js";
export type { ToolInvocationOptions } from "./client.js";

// OAuth utilities
export { OAuthManager } from "./oauth/manager.js";
export { OAuthWindowManager, sendCallbackToOpener } from "./oauth/window-manager.js";
export { generateCodeVerifier, generateCodeChallenge, generateState, generateStateWithReturnUrl, parseState } from "./oauth/pkce.js";
export type {
  OAuthFlowConfig,
  PopupOptions,
  AuthStatus,
  PendingAuth,
  AuthorizationUrlResponse,
  OAuthCallbackResponse,
  OAuthCallbackParams,
  ProviderTokenData,
  OAuthEventType,
  OAuthEventHandler,
  AuthStartedEvent,
  AuthCompleteEvent,
  AuthErrorEvent,
  AuthDisconnectEvent,
  AuthLogoutEvent,
} from "./oauth/types.js";

// OAuth route adapters
export { OAuthHandler } from "./adapters/base-handler.js";
export type {
  OAuthHandlerConfig,
  AuthorizeRequest,
  AuthorizeResponse,
  CallbackRequest,
  CallbackResponse,
  StatusResponse,
  DisconnectRequest,
  DisconnectResponse,
} from "./adapters/base-handler.js";

// Framework adapters
export { createNextOAuthHandler } from "./adapters/nextjs.js";
export { createOAuthRedirectHandler } from "./adapters/nextjs-oauth-redirect.js";
export type { OAuthRedirectConfig } from "./adapters/nextjs-oauth-redirect.js";

export { toNodeHandler, fromNodeHeaders } from "./adapters/node.js";
export { toSolidStartHandler } from "./adapters/solid-start.js";
export { toSvelteKitHandler, svelteKitHandler } from "./adapters/svelte-kit.js";
export { toTanStackStartHandler, createTanStackOAuthHandler } from "./adapters/tanstack-start.js";

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

