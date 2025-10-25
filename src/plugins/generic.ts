/**
 * Generic OAuth Plugin
 * Template for creating custom OAuth provider plugins
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * Generic OAuth plugin configuration
 */
export interface GenericOAuthPluginConfig {
  /** Plugin unique identifier */
  id: string;
  /** OAuth provider name */
  provider: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** OAuth scopes */
  scopes: string[];
  /** Tool names to enable */
  tools: string[];
  /** OAuth redirect URI */
  redirectUri?: string;
  /** Additional provider-specific configuration */
  config?: Record<string, unknown>;
  /** Optional initialization callback */
  onInit?: (client: any) => Promise<void> | void;
  /** Optional after connect callback */
  onAfterConnect?: (client: any) => Promise<void> | void;
  /** Optional disconnect callback */
  onDisconnect?: (client: any) => Promise<void> | void;
}

/**
 * Generic OAuth Plugin
 * 
 * Use this to create custom plugins for any OAuth provider
 * 
 * @example
 * ```typescript
 * const slackPlugin = genericOAuthPlugin({
 *   id: 'slack',
 *   provider: 'slack',
 *   clientId: process.env.SLACK_CLIENT_ID!,
 *   clientSecret: process.env.SLACK_CLIENT_SECRET!,
 *   scopes: ['chat:write', 'channels:read'],
 *   tools: [
 *     'slack/sendMessage',
 *     'slack/listChannels',
 *     'slack/getChannel',
 *   ],
 * });
 * 
 * const client = createMCPClient({
 *   serverUrl: 'http://localhost:3000/mcp',
 *   plugins: [slackPlugin],
 * });
 * ```
 */
export function genericOAuthPlugin(
  config: GenericOAuthPluginConfig
): MCPPlugin<GenericOAuthPluginConfig> {
  const oauth: OAuthConfig<GenericOAuthPluginConfig> = {
    provider: config.provider,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes,
    redirectUri: config.redirectUri,
    config,
  };

  return {
    id: config.id,
    tools: config.tools,
    oauth,
    
    onInit: config.onInit,
    onAfterConnect: config.onAfterConnect,
    onDisconnect: config.onDisconnect,
  };
}

/**
 * Create a simple plugin without OAuth
 * Useful for plugins that just enable certain tools without authentication
 * 
 * @example
 * ```typescript
 * const mathPlugin = createSimplePlugin({
 *   id: 'math',
 *   tools: ['math/add', 'math/subtract', 'math/multiply', 'math/divide'],
 * });
 * ```
 */
export function createSimplePlugin(config: {
  id: string;
  tools: string[];
  onInit?: (client: any) => Promise<void> | void;
  onAfterConnect?: (client: any) => Promise<void> | void;
  onDisconnect?: (client: any) => Promise<void> | void;
}): MCPPlugin {
  return {
    id: config.id,
    tools: config.tools,
    onInit: config.onInit,
    onAfterConnect: config.onAfterConnect,
    onDisconnect: config.onDisconnect,
  };
}

