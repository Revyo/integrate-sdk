/**
 * Configuration Types
 * Type-safe configuration with inference
 */

import type { MCPIntegration } from "../integrations/types.js";
import type { AuthenticationError } from "../errors.js";
import type { ProviderTokenData } from "../oauth/types.js";

/**
 * Re-authentication context provided to the callback
 */
export interface ReauthContext {
  /** The integration/provider that needs re-authentication */
  provider: string;
  /** The error that triggered re-authentication */
  error: AuthenticationError;
  /** The tool name that was being called (if applicable) */
  toolName?: string;
}

/**
 * Re-authentication handler function
 * Called when authentication fails and user needs to re-authenticate
 * Should return true if re-authentication was successful, false otherwise
 */
export type ReauthHandler = (context: ReauthContext) => Promise<boolean> | boolean;

/**
 * Server-side configuration (extends client config with API key)
 * 
 * API key is only available server-side for security reasons.
 */
export interface MCPServerConfig<TIntegrations extends readonly MCPIntegration[]> extends MCPClientConfig<TIntegrations> {
  /**
   * API Key for authentication and usage tracking (SERVER-SIDE ONLY)
   * Sent as X-API-KEY header to the MCP server for tracking API usage
   * Used by Polar.sh for usage-based billing
   * 
   * ⚠️ SECURITY: Never expose this in client-side code or environment variables
   * prefixed with NEXT_PUBLIC_ or similar. This should only be used server-side.
   * 
   * @example
   * ```typescript
   * // ✅ CORRECT - Server-side only
   * createMCPServer({
   *   apiKey: process.env.INTEGRATE_API_KEY, // No NEXT_PUBLIC_ prefix
   *   integrations: [...]
   * })
   * 
   * // ❌ WRONG - Never do this
   * createMCPClient({
   *   apiKey: process.env.NEXT_PUBLIC_INTEGRATE_API_KEY, // Exposed to browser!
   *   integrations: [...]
   * })
   * ```
   */
  apiKey?: string;

  /**
   * Custom token retrieval callback (SERVER-SIDE ONLY)
   * Allows storing OAuth provider tokens in your database instead of localStorage
   * 
   * When provided, this callback is used exclusively for token retrieval (no localStorage fallback).
   * The callback receives the provider name and should return the stored token data or undefined.
   * 
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @returns Provider token data from your database, or undefined if not found
   * 
   * @example
   * ```typescript
   * import { createMCPServer } from 'integrate-sdk/server';
   * import type { ProviderTokenData } from 'integrate-sdk/server';
   * 
   * createMCPServer({
   *   integrations: [...],
   *   getProviderToken: async (provider) => {
   *     const token = await db.tokens.findFirst({
   *       where: { provider, userId: currentUser.id }
   *     });
   *     return token ? {
   *       accessToken: token.accessToken,
   *       refreshToken: token.refreshToken,
   *       tokenType: token.tokenType,
   *       expiresIn: token.expiresIn,
   *       expiresAt: token.expiresAt,
   *       scopes: token.scopes,
   *     } : undefined;
   *   }
   * });
   * ```
   */
  getProviderToken?: (provider: string) => Promise<ProviderTokenData | undefined> | ProviderTokenData | undefined;

  /**
   * Custom token storage callback (SERVER-SIDE ONLY)
   * Allows saving OAuth provider tokens to your database
   * 
   * When provided, this callback is used for storing tokens after OAuth completion.
   * If not provided, tokens retrieved via getProviderToken are assumed to be read-only.
   * 
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @param tokenData - Token data to store in your database
   * 
   * @example
   * ```typescript
   * import { createMCPServer } from 'integrate-sdk/server';
   * import type { ProviderTokenData } from 'integrate-sdk/server';
   * 
   * createMCPServer({
   *   integrations: [...],
   *   setProviderToken: async (provider, tokenData) => {
   *     await db.tokens.upsert({
   *       where: { provider_userId: { provider, userId: currentUser.id } },
   *       create: { provider, userId: currentUser.id, ...tokenData },
   *       update: tokenData,
   *     });
   *   }
   * });
   * ```
   */
  setProviderToken?: (provider: string, tokenData: ProviderTokenData) => Promise<void> | void;
}

/**
 * Main client configuration
 */
export interface MCPClientConfig<TIntegrations extends readonly MCPIntegration[]> {
  /** Array of integrations to enable */
  integrations: TIntegrations;

  /**
   * MCP Server URL (SERVER-SIDE ONLY - for createMCPServer)
   * 
   * ⚠️ DO NOT configure this in client-side code (createMCPClient)!
   * The client calls YOUR API routes at apiRouteBase/mcp, which then call the MCP server.
   * 
   * This is only used server-side to specify which MCP backend to connect to.
   * 
   * @default 'https://mcp.integrate.dev/api/v1/mcp'
   * 
   * @example
   * ```typescript
   * // Server-side only - point to a different MCP backend
   * createMCPServer({
   *   serverUrl: 'http://localhost:8080/api/v1/mcp',
   *   integrations: [githubIntegration({ ... })]
   * })
   * ```
   * 
   * @internal This is primarily for server configuration
   */
  serverUrl?: string;

  /**
   * Base origin URL for your API routes (client-side configuration)
   * Use this when your API routes are hosted on a different domain than your frontend
   * 
   * The client will make requests to:
   * - {apiBaseUrl}{apiRouteBase}/mcp (for tool calls)
   * - {apiBaseUrl}{oauthApiBase}/authorize (for OAuth)
   * 
   * @default window.location.origin (browser) or undefined (server)
   * 
   * @example
   * ```typescript
   * // Frontend on localhost:3000, API on localhost:4000
   * createMCPClient({
   *   apiBaseUrl: 'http://localhost:4000',
   *   integrations: [githubIntegration({ ... })]
   * })
   * // Will call: http://localhost:4000/api/integrate/mcp
   * 
   * // Frontend on app.example.com, API on api.example.com
   * createMCPClient({
   *   apiBaseUrl: 'https://api.example.com',
   *   integrations: [githubIntegration({ ... })]
   * })
   * // Will call: https://api.example.com/api/integrate/mcp
   * ```
   */
  apiBaseUrl?: string;

  /** Optional HTTP headers to include in requests */
  headers?: Record<string, string>;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Client information */
  clientInfo?: {
    name: string;
    version: string;
  };

  /**
   * Handler called when authentication fails and re-authentication is needed
   * This is typically called when OAuth tokens expire or become invalid
   * 
   * @param context - Information about the authentication failure
   * @returns Promise<boolean> - true if re-authentication was successful, false otherwise
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration(...)],
   *   onReauthRequired: async (context) => {
   *     console.log(`Re-auth needed for ${context.provider}`);
   *     // Trigger your OAuth flow here
   *     // Return true if successful, false otherwise
   *     return await triggerOAuthFlow(context.provider);
   *   }
   * });
   * ```
   */
  onReauthRequired?: ReauthHandler;

  /**
   * Maximum number of automatic retry attempts when authentication fails
   * Default: 1 (one retry after re-authentication)
   * Set to 0 to disable automatic retries
   */
  maxReauthRetries?: number;

  /**
   * Connection behavior
   * 
   * - 'lazy' (default): Automatically connects on first method call
   * - 'eager': Connects immediately when createMCPClient is called
   * - 'manual': Requires manual connect() call (original behavior)
   * 
   * @default 'lazy'
   */
  connectionMode?: 'lazy' | 'eager' | 'manual';

  /**
   * Whether to use singleton pattern and reuse client instances
   * 
   * - true (default): Reuses client with same configuration
   * - false: Always creates a new instance
   * 
   * @default true
   */
  singleton?: boolean;

  /**
   * Automatically cleanup (disconnect) on process exit
   * 
   * @default true
   */
  autoCleanup?: boolean;

  /**
   * OAuth flow configuration
   * Controls how OAuth authorization is handled (popup vs redirect)
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   oauthFlow: {
   *     mode: 'popup',
   *     popupOptions: { width: 600, height: 700 }
   *   }
   * });
   * ```
   */
  oauthFlow?: {
    /** How to display OAuth authorization (default: 'redirect') */
    mode?: 'popup' | 'redirect';
    /** Popup window dimensions (only for popup mode) */
    popupOptions?: {
      width?: number;
      height?: number;
    };
    /** Custom callback handler for receiving auth code */
    onAuthCallback?: (provider: string, code: string, state: string) => Promise<void>;
  };

  /**
   * Session token for authenticated requests
   * Set automatically after OAuth flow completes
   * Can be provided manually if you manage tokens externally
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   sessionToken: 'existing-session-token'
   * });
   * ```
   */
  sessionToken?: string;

  /**
   * Base URL for OAuth API routes
   * These routes should be mounted in your application to handle OAuth securely
   * 
   * The SDK will call:
   * - POST {oauthApiBase}/authorize - Get authorization URL
   * - POST {oauthApiBase}/callback - Exchange code for token
   * - GET {oauthApiBase}/status - Check authorization status
   * 
   * @default '/api/integrate/oauth'
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   oauthApiBase: '/api/integrate/oauth'
   * });
   * ```
   */
  oauthApiBase?: string;

  /**
   * Base URL for API routes (including MCP tool calls)
   * Used to route tool calls through server-side handlers instead of directly to MCP server
   * 
   * The SDK will call:
   * - POST {apiRouteBase}/mcp - Execute MCP tool calls
   * 
   * @default '/api/integrate'
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   apiRouteBase: '/api/integrate'
   * });
   * ```
   */
  apiRouteBase?: string;

  /**
   * Automatically detect and handle OAuth callbacks from URL hash fragments
   * When true, the SDK will automatically process #oauth_callback={...} in the URL
   * 
   * @default true
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   autoHandleOAuthCallback: false // Disable automatic callback handling
   * });
   * ```
   */
  autoHandleOAuthCallback?: boolean;

  /**
   * Configure behavior when OAuth callback processing fails
   * 
   * - 'silent': Clean up URL hash and suppress errors (default)
   * - 'console': Log error to console and clean up URL hash
   * - 'redirect': Redirect to specified URL on error
   * 
   * @default 'silent'
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   integrations: [githubIntegration({ ... })],
   *   oauthCallbackErrorBehavior: {
   *     mode: 'redirect',
   *     redirectUrl: '/auth-error'
   *   }
   * });
   * ```
   */
  oauthCallbackErrorBehavior?: {
    mode: 'silent' | 'console' | 'redirect';
    redirectUrl?: string;
  };

  /**
   * Global OAuth redirect URI for all providers
   * Used as fallback when individual integrations don't specify their own redirectUri
   * 
   * **Server-side (createMCPServer):** If not provided, auto-detects from environment:
   * - INTEGRATE_URL (primary)
   * - VERCEL_URL
   * - Falls back to 'http://localhost:3000/api/integrate/oauth/callback'
   * 
   * **Client-side (createMCPClient):** If not provided, auto-detects from:
   * - window.location.origin + oauthApiBase + '/callback'
   * - Example: 'http://localhost:3000/api/integrate/oauth/callback'
   * 
   * @example
   * ```typescript
   * // Explicit redirectUri (server-side)
   * createMCPServer({
   *   redirectUri: 'https://myapp.com/oauth/callback',
   *   integrations: [...]
   * })
   * 
   * // Auto-detection (server-side) - uses process.env.INTEGRATE_URL
   * createMCPServer({
   *   integrations: [...]
   * })
   * 
   * // Auto-detection (client-side) - uses window.location.origin
   * createMCPClient({
   *   integrations: [...]
   * })
   * ```
   */
  redirectUri?: string;
}

/**
 * Helper type to infer enabled tools from integrations
 */
export type InferEnabledTools<TIntegrations extends readonly MCPIntegration[]> =
  TIntegrations[number]["tools"][number];

/**
 * Helper type to create a tools object type from integration array
 */
export type InferToolsObject<TIntegrations extends readonly MCPIntegration[]> = {
  [K in TIntegrations[number]as K["id"]]: K["tools"];
};

