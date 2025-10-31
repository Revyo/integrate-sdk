/**
 * Generic OAuth Plugin
 * Configure OAuth and enable tools for any integration supported by the server
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * Generic OAuth plugin configuration
 */
export interface GenericOAuthPluginConfig {
  /** Plugin unique identifier (must match the integration ID on the server) */
  id: string;
  /** OAuth provider name */
  provider: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** OAuth scopes */
  scopes: string[];
  /** Tool names to enable from the server (must exist on the server) */
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
 * Configure OAuth and enable tools for any integration supported by the Integrate MCP server.
 * Note: This does NOT create new tools - it only configures access to existing server-side tools.
 * All tools must be implemented on the server and exposed via the MCP protocol.
 * 
 * @example
 * ```typescript
 * // Configure Slack integration (assuming server supports Slack tools)
 * const slackPlugin = genericOAuthPlugin({
 *   id: 'slack',
 *   provider: 'slack',
 *   clientId: process.env.SLACK_CLIENT_ID!,
 *   clientSecret: process.env.SLACK_CLIENT_SECRET!,
 *   scopes: ['chat:write', 'channels:read'],
 *   tools: [
 *     'slack_send_message',      // Must exist on server
 *     'slack_list_channels',     // Must exist on server
 *   ],
 * });
 * 
 * const client = createMCPClient({
 *   plugins: [slackPlugin],
 * });
 * 
 * await client.connect();
 * // Call server tools using _callToolByName
 * await client._callToolByName('slack_send_message', { channel: '#general', text: 'Hello' });
 * ```
 */
export function genericOAuthPlugin(
  config: GenericOAuthPluginConfig
): MCPPlugin {
  const oauth: OAuthConfig = {
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
 * Enable server-provided tools that don't require authentication
 * Note: Tools must exist on the server - this does not create new tools
 * 
 * @example
 * ```typescript
 * // Enable server-provided math tools (if they exist on the server)
 * const mathPlugin = createSimplePlugin({
 *   id: 'math',
 *   tools: ['math_add', 'math_subtract', 'math_multiply', 'math_divide'],
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

