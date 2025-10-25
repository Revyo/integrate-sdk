/**
 * Plugin System Types
 * Inspired by BetterAuth's provider pattern
 */

import type { MCPClient } from "../client.js";

/**
 * OAuth Configuration for a plugin
 */
export interface OAuthConfig<TConfig = Record<string, unknown>> {
  /** OAuth provider identifier (e.g., 'github', 'google') */
  provider: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** Required OAuth scopes */
  scopes: string[];
  /** Redirect URI for OAuth flow */
  redirectUri?: string;
  /** Provider-specific configuration */
  config?: TConfig;
}

/**
 * MCP Plugin Interface
 * 
 * Plugins enable specific tools and configure OAuth providers
 */
export interface MCPPlugin<TConfig = Record<string, unknown>> {
  /** Unique plugin identifier */
  id: string;
  
  /** List of tool names this plugin enables */
  tools: string[];
  
  /** OAuth configuration for this plugin */
  oauth?: OAuthConfig<TConfig>;
  
  /** Called when the plugin is initialized with the client */
  onInit?: (client: MCPClient) => Promise<void> | void;
  
  /** Called before the client connects to the server */
  onBeforeConnect?: (client: MCPClient) => Promise<void> | void;
  
  /** Called after the client successfully connects */
  onAfterConnect?: (client: MCPClient) => Promise<void> | void;
  
  /** Called when the client disconnects */
  onDisconnect?: (client: MCPClient) => Promise<void> | void;
}

/**
 * Helper type to extract plugin IDs from an array of plugins
 */
export type ExtractPluginIds<T extends readonly MCPPlugin[]> = T[number]["id"];

/**
 * Helper type to extract tools from an array of plugins
 */
export type ExtractPluginTools<T extends readonly MCPPlugin[]> = T[number]["tools"][number];

/**
 * Type guard to check if a plugin has OAuth configuration
 */
export function hasOAuthConfig(
  plugin: MCPPlugin
): plugin is MCPPlugin & { oauth: OAuthConfig } {
  return plugin.oauth !== undefined;
}

