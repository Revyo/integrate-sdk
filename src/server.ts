/**
 * Server-Side SDK
 * Use this for server-side configuration with OAuth secrets
 */

import { MCPClient } from './client.js';
import type { MCPClientConfig } from './config/types.js';
import type { MCPPlugin } from './plugins/types.js';
import { createNextOAuthHandler } from './adapters/nextjs.js';

/**
 * Global registry for server configuration
 * Stores OAuth provider configuration for singleton handlers
 */
let globalServerConfig: {
  providers: Record<string, {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
  }>;
} | null = null;

/**
 * Auto-detect base URL from environment variables
 * Checks VERCEL_URL, NEXTAUTH_URL, and falls back to localhost
 * 
 * @returns Default redirect URI based on environment
 */
function getDefaultRedirectUri(): string {
  // In browser context (should not happen for server SDK)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/oauth/callback`;
  }
  
  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/oauth/callback`;
  }
  
  // NextAuth URL or custom base URL
  if (process.env.NEXTAUTH_URL) {
    return `${process.env.NEXTAUTH_URL}/oauth/callback`;
  }
  
  // Development fallback
  return 'http://localhost:3000/oauth/callback';
}

/**
 * Create MCP Server instance with OAuth secrets
 * 
 * This is for SERVER-SIDE ONLY - includes OAuth secrets from environment variables.
 * Use this in your server configuration file (e.g., lib/integrate-server.ts)
 * 
 * The redirectUri can be specified globally and will be used for all plugins.
 * If not provided, it will auto-detect from VERCEL_URL or NEXTAUTH_URL.
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts (server-side only!)
 * import { createMCPServer, githubPlugin, gmailPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient } = createMCPServer({
 *   redirectUri: process.env.VERCEL_URL 
 *     ? `https://${process.env.VERCEL_URL}/oauth/callback`
 *     : 'http://localhost:3000/oauth/callback',
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
 * export { POST, GET } from 'integrate-sdk/server';
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

  // Extract OAuth providers from plugins with global redirectUri fallback
  const providers: Record<string, {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
  }> = {};

  for (const plugin of config.plugins) {
    if (plugin.oauth) {
      const { clientId, clientSecret, redirectUri: pluginRedirectUri } = plugin.oauth;
      
      if (!clientId || !clientSecret) {
        console.warn(
          `Warning: Plugin "${plugin.id}" is missing OAuth credentials. ` +
          `Provide clientId and clientSecret in the plugin configuration.`
        );
        continue;
      }

      // Use plugin-specific redirectUri, fall back to global config, then auto-detect
      const redirectUri = pluginRedirectUri || config.redirectUri || getDefaultRedirectUri();

      providers[plugin.id] = {
        clientId,
        clientSecret,
        redirectUri,
      };
    }
  }

  // Register config globally for singleton handlers
  globalServerConfig = { providers };

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

/**
 * Singleton POST handler for OAuth routes
 * Uses the configuration from createMCPServer()
 * 
 * This handler must be used after calling createMCPServer() to register
 * OAuth provider configuration.
 * 
 * @example
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts
 * export { POST, GET } from 'integrate-sdk/server';
 * ```
 */
export const POST = async (
  req: any,
  context: { params: { action: string } | Promise<{ action: string }> }
) => {
  if (!globalServerConfig) {
    return Response.json(
      { error: 'OAuth not configured. Call createMCPServer() in your server initialization file first.' },
      { status: 500 }
    );
  }
  
  const handler = createNextOAuthHandler(globalServerConfig);
  const routes = handler.createRoutes();
  return routes.POST(req, context);
};

/**
 * Singleton GET handler for OAuth routes
 * Uses the configuration from createMCPServer()
 * 
 * This handler must be used after calling createMCPServer() to register
 * OAuth provider configuration.
 * 
 * @example
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts
 * export { POST, GET } from 'integrate-sdk/server';
 * ```
 */
export const GET = async (
  req: any,
  context: { params: { action: string } | Promise<{ action: string }> }
) => {
  if (!globalServerConfig) {
    return Response.json(
      { error: 'OAuth not configured. Call createMCPServer() in your server initialization file first.' },
      { status: 500 }
    );
  }
  
  const handler = createNextOAuthHandler(globalServerConfig);
  const routes = handler.createRoutes();
  return routes.GET(req, context);
};

