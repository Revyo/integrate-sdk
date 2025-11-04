/**
 * Server-Side SDK
 * Use this for server-side configuration with OAuth secrets
 */

import { MCPClient } from './client.js';
import type { MCPClientConfig } from './config/types.js';
import type { MCPPlugin } from './plugins/types.js';

/**
 * Create MCP Server instance with OAuth secrets
 * 
 * This is for SERVER-SIDE ONLY - includes OAuth secrets from environment variables.
 * Use this in your server configuration file (e.g., lib/integrate-server.ts)
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts (server-side only!)
 * import { createMCPServer, githubPlugin, gmailPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient, POST, GET } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       scopes: ['repo', 'user'],
 *     }),
 *     gmailPlugin({
 *       clientId: process.env.GMAIL_CLIENT_ID!,
 *       clientSecret: process.env.GMAIL_CLIENT_SECRET!,
 *       scopes: ['gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * Then in your route file:
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts
 * export { POST, GET } from '@/lib/integrate-server';
 * ```
 */
export function createMCPServer<TPlugins extends readonly MCPPlugin[]>(
  config: MCPClientConfig<TPlugins>
) {
  // Validate we're on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'createMCPServer() should only be called on the server-side. ' +
      'Use createMCPClient() for client-side code.'
    );
  }

  // Extract OAuth providers from plugins
  const providers: Record<string, {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
  }> = {};

  for (const plugin of config.plugins) {
    if (plugin.oauth) {
      const { clientId, clientSecret, redirectUri } = plugin.oauth;
      
      if (!clientId || !clientSecret) {
        console.warn(
          `Warning: Plugin "${plugin.id}" is missing OAuth credentials. ` +
          `Provide clientId and clientSecret in the plugin configuration.`
        );
        continue;
      }

      providers[plugin.id] = {
        clientId,
        clientSecret,
        redirectUri,
      };
    }
  }

  // Create the client instance
  const client = new MCPClient(config);

  // Create route handlers with the provider configuration
  const { POST, GET } = createOAuthRouteHandlers({ providers });

  return {
    /** Server-side MCP client instance */
    client,
    
    /** OAuth POST handler - export this from your route file */
    POST,
    
    /** OAuth GET handler - export this from your route file */
    GET,
  };
}

/**
 * Create OAuth route handlers for Next.js App Router
 * Internal function used by createMCPServer
 */
function createOAuthRouteHandlers(config: { providers: Record<string, any> }) {
  const { createNextOAuthHandler } = require('./adapters/nextjs.js');
  const handler = createNextOAuthHandler(config);
  return handler.createRoutes();
}

// Re-export plugin types for convenience
export type { MCPPlugin } from './plugins/types.js';
export type { MCPClientConfig } from './config/types.js';

// Re-export plugins
export { githubPlugin } from './plugins/github.js';
export { gmailPlugin } from './plugins/gmail.js';
export { genericOAuthPlugin, createSimplePlugin } from './plugins/generic.js';

