/**
 * Server-Side SDK
 * Use this for server-side configuration with OAuth secrets
 */

import { MCPClient } from './client.js';
import type { MCPServerConfig } from './config/types.js';
import type { MCPPlugin } from './plugins/types.js';
import { createNextOAuthHandler } from './adapters/nextjs.js';
import { getEnv } from './utils/env.js';

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
  serverUrl?: string;
  apiKey?: string;
} | null = null;

/**
 * Auto-detect base URL from environment variables
 * Checks INTEGRATE_URL, VERCEL_URL, and falls back to localhost
 * 
 * @returns Default redirect URI based on environment
 */
function getDefaultRedirectUri(): string {
  // In browser context (should not happen for server SDK)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/integrate/oauth/callback`;
  }

  // Integrate URL (primary option)
  const integrateUrl = getEnv('INTEGRATE_URL');
  if (integrateUrl) {
    return `${integrateUrl}/api/integrate/oauth/callback`;
  }

  // Vercel deployment
  const vercelUrl = getEnv('VERCEL_URL');
  if (vercelUrl) {
    return `https://${vercelUrl}/api/integrate/oauth/callback`;
  }

  // Development fallback
  return 'http://localhost:3000/api/integrate/oauth/callback';
}

/**
 * Create MCP Server instance with OAuth secrets (SERVER-SIDE ONLY)
 * 
 * This is for SERVER-SIDE ONLY - includes OAuth secrets and API key from environment variables.
 * Use this in your server configuration file (e.g., lib/integrate-server.ts)
 * 
 * The redirectUri can be specified globally and will be used for all plugins.
 * If not provided, it will auto-detect from INTEGRATE_URL or VERCEL_URL
 * 
 * ⚠️ SECURITY: The API key should NEVER be exposed to client-side code.
 * Use environment variables WITHOUT the NEXT_PUBLIC_ prefix.
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts (server-side only!)
 * import { createMCPServer, githubPlugin, gmailPlugin } from 'integrate-sdk/server';
 * 
 * // ✅ CORRECT - Server-side only, API key from secure env var
 * export const { client: serverClient } = createMCPServer({
 *   apiKey: process.env.INTEGRATE_API_KEY, // ✅ No NEXT_PUBLIC_ prefix
 *   redirectUri: process.env.INTEGRATE_URL 
 *     ? `${process.env.INTEGRATE_URL}/oauth/callback`
 *     : 'http://localhost:3000/api/integrate/oauth/callback',
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
  config: MCPServerConfig<TPlugins>
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

  // Update plugins with default redirectUri where needed
  const updatedPlugins = config.plugins.map(plugin => {
    if (plugin.oauth) {
      const { clientId, clientSecret, redirectUri: pluginRedirectUri } = plugin.oauth;

      if (!clientId || !clientSecret) {
        console.warn(
          `Warning: Plugin "${plugin.id}" is missing OAuth credentials. ` +
          `Provide clientId and clientSecret in the plugin configuration.`
        );
        return plugin;
      }

      // Use plugin-specific redirectUri, fall back to global config, then auto-detect
      const redirectUri = pluginRedirectUri || config.redirectUri || getDefaultRedirectUri();

      providers[plugin.id] = {
        clientId,
        clientSecret,
        redirectUri,
      };

      // Update plugin with resolved redirectUri
      return {
        ...plugin,
        oauth: {
          ...plugin.oauth,
          redirectUri,
        },
      };
    }
    return plugin;
  }) as unknown as TPlugins;

  // Register config globally for singleton handlers
  globalServerConfig = {
    providers,
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
  };

  // Create the client instance with lazy connection (same as client-side)
  const clientConfig = {
    ...config,
    plugins: updatedPlugins,
    connectionMode: config.connectionMode || 'lazy',
    singleton: config.singleton ?? true,
  };
  const client = new MCPClient(clientConfig);

  // Set API key header for authentication and usage tracking (server-side only)
  if (config.apiKey) {
    client.setRequestHeader('X-API-KEY', config.apiKey);
  }

  // Attach OAuth config to the client for toNextJsHandler access
  (client as any).__oauthConfig = {
    providers,
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
  };

  // Create route handlers with the provider configuration
  const { POST, GET } = createOAuthRouteHandlers({
    providers,
    serverUrl: config.serverUrl,
    apiKey: config.apiKey,
  });

  /**
   * Unified handler function that handles both POST and GET requests
   * Useful for frameworks like Astro, Remix, etc. that use a single handler
   * 
   * @param request - The incoming request
   * @param context - Optional context with params (for frameworks that support it)
   * @returns Response
   */
  const handler = async (
    request: Request,
    context?: { params?: { action?: string; all?: string | string[] } }
  ): Promise<Response> => {
    const method = request.method.toUpperCase();

    // Extract action from context params or URL
    let action: string | undefined;
    if (context?.params?.action) {
      action = context.params.action;
    } else if (context?.params?.all) {
      // For catch-all routes like [...all]
      const all = context.params.all;
      if (Array.isArray(all)) {
        action = all[all.length - 1];
      } else if (typeof all === 'string') {
        action = all.split('/').pop();
      }
    } else {
      // Try to extract from URL path
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      action = pathParts[pathParts.length - 1] || 'callback';
    }

    const handlerContext = { params: { action: action || 'callback' } };

    if (method === 'POST') {
      return POST(request, handlerContext);
    } else if (method === 'GET') {
      return GET(request, handlerContext);
    } else {
      return Response.json(
        { error: `Method ${method} not allowed` },
        { status: 405 }
      );
    }
  };

  return {
    /** Server-side MCP client instance with auto-connection */
    client,

    /** OAuth POST handler - export this from your route file */
    POST,

    /** OAuth GET handler - export this from your route file */
    GET,

    /** Unified handler function - handles both POST and GET requests */
    handler,
  };
}

/**
 * Create OAuth route handlers for Next.js App Router
 * Internal function used by createMCPServer
 */
function createOAuthRouteHandlers(config: { providers: Record<string, any>; serverUrl?: string; apiKey?: string }) {
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

/**
 * Create catch-all route handlers from the global server configuration
 * 
 * This is a helper function to create POST and GET handlers for catch-all routes
 * that use the configuration from createMCPServer().
 * 
 * @param redirectConfig - Optional configuration for OAuth redirect behavior
 * @returns Object with POST and GET handlers for Next.js catch-all routes
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       scopes: ['repo', 'user'],
 *     }),
 *   ],
 * });
 * 
 * // app/api/integrate/[...all]/route.ts
 * 
 * // RECOMMENDED: Import serverClient from your server setup file
 * import { serverClient } from '@/lib/integrate-server';
 * import { toNextJsHandler } from 'integrate-sdk/server';
 * 
 * export const { POST, GET } = toNextJsHandler({
 *   client: serverClient,  // Pass the client from createMCPServer
 *   redirectUrl: '/dashboard',
 * });
 * 
 * // Alternative: Provide config inline
 * export const { POST, GET } = toNextJsHandler({
 *   config: {
 *     providers: {
 *       github: {
 *         clientId: process.env.GITHUB_CLIENT_ID!,
 *         clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       },
 *     },
 *   },
 *   redirectUrl: '/dashboard',
 * });
 * ```
 */
export function toNextJsHandler(options: {
  /** Server client instance from createMCPServer (extracts config automatically) */
  client?: any;
  /** Custom OAuth handler config (provide inline) */
  config?: {
    providers: Record<string, {
      clientId: string;
      clientSecret: string;
      redirectUri?: string;
    }>;
    serverUrl?: string;
  };
  /** URL to redirect to after successful OAuth */
  redirectUrl?: string;
  /** URL to redirect to on OAuth error */
  errorRedirectUrl?: string;
}) {
  /**
   * POST handler for catch-all OAuth routes
   * Handles authorize, callback, and disconnect actions
   */
  const POST = async (
    req: any,
    context: { params: { all: string[] } | Promise<{ all: string[] }> }
  ) => {
    // Extract config from client or use provided config
    const config = options.config || (options.client as any)?.__oauthConfig;
    if (!config) {
      return Response.json(
        { error: 'OAuth not configured. You must pass either "client" (from createMCPServer) or "config" to toNextJsHandler().' },
        { status: 500 }
      );
    }

    const handler = createNextOAuthHandler(config);
    const routes = handler.toNextJsHandler({
      redirectUrl: options.redirectUrl,
      errorRedirectUrl: options.errorRedirectUrl,
    });
    return routes.POST(req, context);
  };

  /**
   * GET handler for catch-all OAuth routes
   * Handles status checks and OAuth provider redirects
   */
  const GET = async (
    req: any,
    context: { params: { all: string[] } | Promise<{ all: string[] }> }
  ) => {
    // Extract config from client or use provided config
    const config = options.config || (options.client as any)?.__oauthConfig;
    if (!config) {
      return Response.json(
        { error: 'OAuth not configured. You must pass either "client" (from createMCPServer) or "config" to toNextJsHandler().' },
        { status: 500 }
      );
    }

    const handler = createNextOAuthHandler(config);
    const routes = handler.toNextJsHandler({
      redirectUrl: options.redirectUrl,
      errorRedirectUrl: options.errorRedirectUrl,
    });
    return routes.GET(req, context);
  };

  return { POST, GET };
}

