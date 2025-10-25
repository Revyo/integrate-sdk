/**
 * Configuration Types
 * Type-safe configuration with inference
 */

import type { MCPPlugin } from "../plugins/types.js";

/**
 * Main client configuration
 */
export interface MCPClientConfig<TPlugins extends readonly MCPPlugin[]> {
  /** URL of the MCP server */
  serverUrl: string;
  
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

