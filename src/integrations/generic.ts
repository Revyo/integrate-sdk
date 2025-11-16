/**
 * Generic OAuth Integration
 * Configure OAuth and enable tools for any integration supported by the server
 */

import type { MCPIntegration, OAuthConfig } from "./types.js";
import { getEnv } from "../utils/env.js";

/**
 * Generic OAuth integration configuration
 */
export interface GenericOAuthIntegrationConfig {
  /** Integration unique identifier (must match the integration ID on the server) */
  id: string;
  /** OAuth provider name */
  provider: string;
  /** OAuth client ID (defaults to {PROVIDER}_CLIENT_ID env var) */
  clientId?: string;
  /** OAuth client secret (defaults to {PROVIDER}_CLIENT_SECRET env var) */
  clientSecret?: string;
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
 * Generic OAuth Integration
 * 
 * Configure OAuth and enable tools for any integration supported by the Integrate MCP server.
 * Note: This does NOT create new tools - it only configures access to existing server-side tools.
 * All tools must be implemented on the server and exposed via the MCP protocol.
 * 
 * By default, reads {PROVIDER}_CLIENT_ID and {PROVIDER}_CLIENT_SECRET from environment variables
 * (e.g., SLACK_CLIENT_ID, SLACK_CLIENT_SECRET). You can override these by providing explicit values.
 * 
 * @example Minimal (uses env vars):
 * ```typescript
 * // Automatically uses SLACK_CLIENT_ID and SLACK_CLIENT_SECRET from env
 * const slackIntegration = genericOAuthIntegration({
 *   id: 'slack',
 *   provider: 'slack',
 *   scopes: ['chat:write', 'channels:read'],
 *   tools: [
 *     'slack_send_message',      // Must exist on server
 *     'slack_list_channels',     // Must exist on server
 *   ],
 * });
 * 
 * const client = createMCPClient({
 *   integrations: [slackIntegration],
 * });
 * 
 * await client.connect();
 * // Call server tools using _callToolByName
 * await client._callToolByName('slack_send_message', { channel: '#general', text: 'Hello' });
 * ```
 * 
 * @example With explicit override:
 * ```typescript
 * const slackIntegration = genericOAuthIntegration({
 *   id: 'slack',
 *   provider: 'slack',
 *   clientId: process.env.CUSTOM_SLACK_ID!,
 *   clientSecret: process.env.CUSTOM_SLACK_SECRET!,
 *   scopes: ['chat:write', 'channels:read'],
 *   tools: ['slack_send_message', 'slack_list_channels'],
 * });
 * ```
 */
export function genericOAuthIntegration(
  config: GenericOAuthIntegrationConfig
): MCPIntegration {
  const providerUpper = config.provider.toUpperCase().replace(/[^A-Z0-9]/g, '_');

  const oauth: OAuthConfig = {
    provider: config.provider,
    clientId: config.clientId ?? getEnv(`${providerUpper}_CLIENT_ID`),
    clientSecret: config.clientSecret ?? getEnv(`${providerUpper}_CLIENT_SECRET`),
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
 * Create a simple integration without OAuth
 * Enable server-provided tools that don't require authentication
 * Note: Tools must exist on the server - this does not create new tools
 * 
 * @example
 * ```typescript
 * // Enable server-provided math tools (if they exist on the server)
 * const mathIntegration = createSimpleIntegration({
 *   id: 'math',
 *   tools: ['math_add', 'math_subtract', 'math_multiply', 'math_divide'],
 * });
 * ```
 */
export function createSimpleIntegration(config: {
  id: string;
  tools: string[];
  onInit?: (client: any) => Promise<void> | void;
  onAfterConnect?: (client: any) => Promise<void> | void;
  onDisconnect?: (client: any) => Promise<void> | void;
}): MCPIntegration {
  return {
    id: config.id,
    tools: config.tools,
    onInit: config.onInit,
    onAfterConnect: config.onAfterConnect,
    onDisconnect: config.onDisconnect,
  };
}

