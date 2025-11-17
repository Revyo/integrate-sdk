/**
 * Integration System Types
 * Inspired by BetterAuth's provider pattern
 */

import type { MCPClientBase } from "../client.js";

/**
 * OAuth Configuration for a integration
 * 
 * CLIENT-SIDE: You no longer need to provide clientId/clientSecret in the browser.
 * These should be kept server-side in your OAuth API routes for security.
 * 
 * SERVER-SIDE: OAuth credentials are provided via API route configuration
 * using createNextOAuthHandler() or createTanStackOAuthHandler().
 */
export interface OAuthConfig {
  /** OAuth provider identifier (e.g., 'github', 'google') */
  provider: string;

  /** 
   * OAuth client ID (optional - only needed for legacy direct MCP server calls)
   * @deprecated Keep client ID server-side in OAuth API route configuration
   */
  clientId?: string | undefined;

  /** 
   * OAuth client secret (optional - only needed for legacy direct MCP server calls)
   * @deprecated Keep client secret server-side in OAuth API route configuration
   */
  clientSecret?: string | undefined;

  /** Required OAuth scopes */
  scopes: string[];

  /** Redirect URI for OAuth flow */
  redirectUri?: string;

  /** Provider-specific configuration */
  config?: unknown;
}

/**
 * MCP Integration Interface
 * 
 * Integrations enable specific tools and configure OAuth providers
 * 
 * @template TId - The literal type of the integration ID (e.g., "github", "gmail")
 */
export interface MCPIntegration<TId extends string = string> {
  /** Unique integration identifier */
  id: TId;

  /** List of tool names this integration enables */
  tools: string[];

  /** OAuth configuration for this integration */
  oauth?: OAuthConfig;

  /** Called when the integration is initialized with the client */
  onInit?: (client: MCPClientBase<any>) => Promise<void> | void;

  /** Called before the client connects to the server */
  onBeforeConnect?: (client: MCPClientBase<any>) => Promise<void> | void;

  /** Called after the client successfully connects */
  onAfterConnect?: (client: MCPClientBase<any>) => Promise<void> | void;

  /** Called when the client disconnects */
  onDisconnect?: (client: MCPClientBase<any>) => Promise<void> | void;
}

/**
 * Helper type to extract integration IDs from an array of integrations
 */
export type ExtractIntegrationIds<T extends readonly MCPIntegration[]> = T[number]["id"];

/**
 * Helper type to extract tools from an array of integrations
 */
export type ExtractIntegrationTools<T extends readonly MCPIntegration[]> = T[number]["tools"][number];

/**
 * Type guard to check if a integration has OAuth configuration
 */
export function hasOAuthConfig(
  integration: MCPIntegration
): integration is MCPIntegration & { oauth: OAuthConfig } {
  return integration.oauth !== undefined;
}

