/**
 * Configuration Types
 * Type-safe configuration with inference
 */

import type { MCPPlugin } from "../plugins/types.js";
import type { AuthenticationError } from "../errors.js";

/**
 * Re-authentication context provided to the callback
 */
export interface ReauthContext {
  /** The plugin/provider that needs re-authentication */
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
 * Main client configuration
 */
export interface MCPClientConfig<TPlugins extends readonly MCPPlugin[]> {
  /** Array of plugins to enable */
  plugins: TPlugins;

  /**
   * Customer ID for usage tracking (REQUIRED)
   * Sent as X-Customer-ID header to the MCP server for tracking API usage
   * Used by Polar.sh for usage-based billing
   * 
   * This field is required to ensure all usage is properly tracked and billed.
   * 
   * @example
   * ```typescript
   * createMCPClient({
   *   customerId: 'cust_xyz789',
   *   plugins: [...]
   * })
   * ```
   */
  customerId: string;

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
   *   plugins: [githubPlugin(...)],
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
   *   plugins: [githubPlugin({ ... })],
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
   *   plugins: [githubPlugin({ ... })],
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
   *   plugins: [githubPlugin({ ... })],
   *   oauthApiBase: '/api/integrate/oauth'
   * });
   * ```
   */
  oauthApiBase?: string;

  /**
   * Automatically detect and handle OAuth callbacks from URL hash fragments
   * When true, the SDK will automatically process #oauth_callback={...} in the URL
   * 
   * @default true
   * 
   * @example
   * ```typescript
   * const client = createMCPClient({
   *   plugins: [githubPlugin({ ... })],
   *   autoHandleOAuthCallback: false // Disable automatic callback handling
   * });
   * ```
   */
  autoHandleOAuthCallback?: boolean;

  /**
   * Global OAuth redirect URI for all providers
   * Used as fallback when individual plugins don't specify their own redirectUri
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
   *   plugins: [...]
   * })
   * 
   * // Auto-detection (server-side) - uses process.env.INTEGRATE_URL
   * createMCPServer({
   *   plugins: [...]
   * })
   * 
   * // Auto-detection (client-side) - uses window.location.origin
   * createMCPClient({
   *   plugins: [...]
   * })
   * ```
   */
  redirectUri?: string;
}

/**
 * Helper type to infer enabled tools from plugins
 */
export type InferEnabledTools<TPlugins extends readonly MCPPlugin[]> =
  TPlugins[number]["tools"][number];

/**
 * Helper type to create a tools object type from plugin array
 */
export type InferToolsObject<TPlugins extends readonly MCPPlugin[]> = {
  [K in TPlugins[number]as K["id"]]: K["tools"];
};

