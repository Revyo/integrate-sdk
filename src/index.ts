/**
 * Integrate SDK
 * Type-safe TypeScript SDK for MCP Client
 */

// Core client
export type { MCPClient } from "./client.js";
export { MCPClientBase, createMCPClient, clearClientCache } from "./client.js";
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
export type { MCPClientConfig, ReauthContext, ReauthHandler, MCPContext, ToolCallOptions } from "./config/types.js";

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

// Integration system
export type {
  MCPIntegration,
  OAuthConfig,
  ExtractIntegrationIds,
  ExtractIntegrationTools,
} from "./integrations/types.js";

// Built-in integrations
export { githubIntegration } from "./integrations/github.js";
export type { GitHubIntegrationConfig, GitHubTools, GitHubIntegrationClient } from "./integrations/github.js";

export { gmailIntegration } from "./integrations/gmail.js";
export type { GmailIntegrationConfig, GmailTools, GmailIntegrationClient } from "./integrations/gmail.js";

// Server client
export type { ServerIntegrationClient } from "./integrations/server-client.js";

export {
  genericOAuthIntegration,
  createSimpleIntegration,
} from "./integrations/generic.js";
export type { GenericOAuthIntegrationConfig } from "./integrations/generic.js";

// Note: AI tools (getVercelAITools, etc.) are only available from 'integrate-sdk/server'
// They are server-side only and should not be imported in client code

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

