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
  [K in TPlugins[number] as K["id"]]: K["tools"];
};

