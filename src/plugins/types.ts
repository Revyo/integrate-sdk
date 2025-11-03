/**
 * Plugin System Types
 * Inspired by BetterAuth's provider pattern
 */

import type { MCPClient } from "../client.js";

/**
 * OAuth Configuration for a plugin
 */
export interface OAuthConfig {
  /** OAuth provider identifier (e.g., 'github', 'google') */
  provider: string;
  /** OAuth client ID */
  clientId: string | undefined;
  /** OAuth client secret */
  clientSecret: string | undefined;
  /** Required OAuth scopes */
  scopes: string[];
  /** Redirect URI for OAuth flow */
  redirectUri?: string;
  /** Provider-specific configuration */
  config?: unknown;
}

/**
 * MCP Plugin Interface
 * 
 * Plugins enable specific tools and configure OAuth providers
 */
export interface MCPPlugin {
  /** Unique plugin identifier */
  id: string;
  
  /** List of tool names this plugin enables */
  tools: string[];
  
  /** OAuth configuration for this plugin */
  oauth?: OAuthConfig;
  
  /** Called when the plugin is initialized with the client */
  onInit?: (client: MCPClient<any>) => Promise<void> | void;
  
  /** Called before the client connects to the server */
  onBeforeConnect?: (client: MCPClient<any>) => Promise<void> | void;
  
  /** Called after the client successfully connects */
  onAfterConnect?: (client: MCPClient<any>) => Promise<void> | void;
  
  /** Called when the client disconnects */
  onDisconnect?: (client: MCPClient<any>) => Promise<void> | void;
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

