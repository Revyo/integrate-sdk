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
 * Server client with attached handler, POST, and GET route handlers
 */
export type MCPServerClient<TPlugins extends readonly MCPPlugin[]> = MCPClient<TPlugins> & {
  /** Unified handler function that handles both POST and GET requests */
  handler: (request: Request, context?: { params?: { action?: string; all?: string | string[] } }) => Promise<Response>;
  /** OAuth POST handler - for Next.js route exports */
  POST: (req: any, context: { params: { action: string } | Promise<{ action: string }> }) => Promise<Response>;
  /** OAuth GET handler - for Next.js route exports */
  GET: (req: any, context: { params: { action: string } | Promise<{ action: string }> }) => Promise<Response>;
};

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
 * The returned client has `handler`, `POST`, and `GET` attached for easy access.
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
 * Then use the handler directly from the client:
 * ```typescript
 * // routes/api/integrate/[...all]/+server.ts (SvelteKit)
 * import { serverClient } from '$lib/integrate-server';
 * 
 * export const POST = serverClient.handler;
 * export const GET = serverClient.handler;
 * ```
 * 
 * Or for Astro:
 * ```typescript
 * // pages/api/integrate/[...all].ts (Astro)
 * import { serverClient } from '@/lib/integrate-server';
 * import type { APIRoute } from 'astro';
 * 
 * export const ALL: APIRoute = async (ctx) => {
 *   return serverClient.handler(ctx.request);
 * };
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
   * Available as `client.handler` for convenience
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
    // Route structure: /api/integrate/oauth/[action]
    // For catch-all routes [...all], the all param would be ['oauth', 'callback'] or ['oauth', 'authorize'], etc.
    let action: string | undefined;
    let segments: string[] = [];

    if (context?.params?.action) {
      action = context.params.action;
    } else if (context?.params?.all) {
      // For catch-all routes like [...all]
      const all = context.params.all;

      if (Array.isArray(all)) {
        segments = all;
      } else if (typeof all === 'string') {
        segments = all.split('/').filter(Boolean);
      }

      // Handle route structure: /api/integrate/oauth/[action] or /api/integrate/mcp
      // segments should be ['oauth', 'callback'] or ['oauth', 'authorize'], etc.
      if (segments.length === 2 && segments[0] === 'oauth') {
        action = segments[1];
      } else if (segments.length === 1) {
        // Check if it's the MCP route (handled separately below)
        if (segments[0] === 'mcp') {
          action = 'mcp';
        } else {
          // Otherwise use it as an OAuth action (for routes like /api/integrate/[action])
          action = segments[0];
        }
      } else if (segments.length > 0) {
        // Fallback: use the last segment
        action = segments[segments.length - 1];
      }
    } else {
      // Try to extract from URL path
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      segments = pathParts;
      // Look for 'oauth' in the path and get the next segment
      const oauthIndex = pathParts.indexOf('oauth');
      if (oauthIndex >= 0 && oauthIndex < pathParts.length - 1) {
        action = pathParts[oauthIndex + 1];
      } else if (pathParts.length > 0) {
        action = pathParts[pathParts.length - 1];
      } else {
        action = 'callback';
      }
    }

    // Handle /mcp route BEFORE validating OAuth routes
    if (action === 'mcp' && method === 'POST') {
      try {
        const body = await request.json();
        const authHeader = request.headers.get('authorization');

        // Create OAuth handler with config that includes API key
        const { OAuthHandler } = await import('./adapters/base-handler.js');
        const oauthHandler = new OAuthHandler({
          providers,
          serverUrl: config.serverUrl,
          apiKey: config.apiKey,
        });

        const result = await oauthHandler.handleToolCall(body, authHeader);
        return Response.json(result);
      } catch (error: any) {
        console.error('[MCP Tool Call] Error:', error);
        return Response.json(
          { error: error.message || 'Failed to execute tool call' },
          { status: error.statusCode || 500 }
        );
      }
    }

    // Validate route structure for catch-all routes
    // Must be /api/integrate/oauth/[action] or /api/integrate/mcp
    if (segments.length > 0) {
      // For catch-all routes, expect ['oauth', 'action'] format or ['mcp']
      if (segments.length === 2 && segments[0] !== 'oauth') {
        return Response.json(
          { error: `Invalid route: /${segments.join('/')}` },
          { status: 404 }
        );
      }
      // MCP route is already handled above
      if (segments.length === 1 && segments[0] === 'mcp') {
        // Already handled, but if we get here it's a non-POST method
        return Response.json(
          { error: `Method ${method} not allowed for /mcp route. Use POST.` },
          { status: 405 }
        );
      }
    }

    // Special handling for GET /oauth/callback (OAuth provider redirect)
    if (method === 'GET' && action === 'callback') {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Use default redirect URLs (can be overridden by wrapper functions)
      const defaultRedirectUrl = '/';
      const errorRedirectUrl = '/auth-error';

      // Handle OAuth error
      if (error) {
        const errorMsg = errorDescription || error;
        console.error('[OAuth Redirect] Error:', errorMsg);

        return Response.redirect(
          new URL(`${errorRedirectUrl}?error=${encodeURIComponent(errorMsg)}`, request.url)
        );
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('[OAuth Redirect] Missing code or state parameter');

        return Response.redirect(
          new URL(`${errorRedirectUrl}?error=${encodeURIComponent('Invalid OAuth callback')}`, request.url)
        );
      }

      // Extract returnUrl from state parameter (with fallbacks)
      let returnUrl = defaultRedirectUrl;

      try {
        // Try to parse state to extract returnUrl
        const { parseState } = await import('./oauth/pkce.js');
        const stateData = parseState(state);
        if (stateData.returnUrl) {
          returnUrl = stateData.returnUrl;
        }
      } catch (e) {
        // If parsing fails, try to use referrer as fallback
        try {
          const referrer = request.headers.get('referer') || request.headers.get('referrer');
          if (referrer) {
            const referrerUrl = new URL(referrer);
            const currentUrl = new URL(request.url);

            // Only use referrer if it's from the same origin (security)
            if (referrerUrl.origin === currentUrl.origin) {
              returnUrl = referrerUrl.pathname + referrerUrl.search;
            }
          }
        } catch {
          // If referrer parsing fails, use default
          // (already set to defaultRedirectUrl)
        }
      }

      // Redirect to the return URL with OAuth params in the hash
      // Using hash to avoid sending sensitive params to the server
      const targetUrl = new URL(returnUrl, request.url);
      targetUrl.hash = `oauth_callback=${encodeURIComponent(JSON.stringify({ code, state }))}`;

      return Response.redirect(targetUrl);
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

  // Attach handler, POST, and GET to the client for convenient access
  const serverClient = client as MCPServerClient<TPlugins>;
  serverClient.handler = handler;
  serverClient.POST = POST;
  serverClient.GET = GET;

  return {
    /** Server-side MCP client instance with auto-connection and attached handler */
    client: serverClient,

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
 * Create catch-all route handlers for Next.js
 * 
 * Supports two usage patterns:
 * 1. Pass a client instance from createMCPServer
 * 2. Pass config object directly (for inline configuration)
 * 
 * @param clientOrOptions - Client instance from createMCPServer, or config options
 * @param redirectOptions - Redirect URL configuration (when first param is a client)
 * @returns Object with POST and GET handlers for Next.js catch-all routes
 * 
 * @example
 * **Pattern 1: Using client from createMCPServer (Recommended)**
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
 * import { serverClient } from '@/lib/integrate-server';
 * import { toNextJsHandler } from 'integrate-sdk/server';
 * 
 * export const { POST, GET } = toNextJsHandler(serverClient, {
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * ```
 * 
 * @example
 * **Pattern 2: Inline configuration**
 * ```typescript
 * // app/api/integrate/[...all]/route.ts
 * import { toNextJsHandler } from 'integrate-sdk/server';
 * 
 * export const { POST, GET } = toNextJsHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * ```
 */
export function toNextJsHandler(
  clientOrOptions?:
    | any  // Client instance from createMCPServer
    | {
      /** OAuth provider configurations */
      providers?: Record<string, {
        clientId: string;
        clientSecret: string;
        redirectUri?: string;
      }>;
      /** Server URL for MCP server */
      serverUrl?: string;
      /** API key for authentication */
      apiKey?: string;
      /** URL to redirect to after successful OAuth callback (default: '/') */
      redirectUrl?: string;
      /** URL to redirect to on OAuth error (default: '/auth-error') */
      errorRedirectUrl?: string;
    },
  redirectOptions?: {
    /** URL to redirect to after successful OAuth callback (default: '/') */
    redirectUrl?: string;
    /** URL to redirect to on OAuth error (default: '/auth-error') */
    errorRedirectUrl?: string;
  }
) {
  // Determine if first argument is a client or config object
  let config: any;
  let redirectUrl: string | undefined;
  let errorRedirectUrl: string | undefined;

  // Pattern 1: No arguments provided (use global config)
  if (!clientOrOptions) {
    config = globalServerConfig;
    redirectUrl = redirectOptions?.redirectUrl;
    errorRedirectUrl = redirectOptions?.errorRedirectUrl;
  }
  // Pattern 2: Client instance provided (extract config from it)
  else if ((clientOrOptions as any).__oauthConfig) {
    config = (clientOrOptions as any).__oauthConfig;
    redirectUrl = redirectOptions?.redirectUrl;
    errorRedirectUrl = redirectOptions?.errorRedirectUrl;
  }
  // Pattern 3: Config object provided (use it directly)
  else if (typeof clientOrOptions === 'object' && clientOrOptions.providers) {
    config = {
      providers: clientOrOptions.providers,
      serverUrl: clientOrOptions.serverUrl,
      apiKey: clientOrOptions.apiKey,
    };
    redirectUrl = clientOrOptions.redirectUrl;
    errorRedirectUrl = clientOrOptions.errorRedirectUrl;
  }
  else {
    // Invalid config
    config = null;
  }

  if (!config) {
    throw new Error(
      'toNextJsHandler requires either:\n' +
      '  1. A client instance from createMCPServer()\n' +
      '  2. A config object with providers property\n' +
      '  3. No arguments (uses global config from createMCPServer)'
    );
  }

  /**
   * POST handler for catch-all OAuth routes
   * Handles authorize, callback, and disconnect actions
   */
  const POST = async (
    req: any,
    context: { params: { all: string[] } | Promise<{ all: string[] }> }
  ) => {
    const handler = createNextOAuthHandler(config);
    const routes = handler.toNextJsHandler({
      redirectUrl,
      errorRedirectUrl,
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
    const handler = createNextOAuthHandler(config);
    const routes = handler.toNextJsHandler({
      redirectUrl,
      errorRedirectUrl,
    });
    return routes.GET(req, context);
  };

  return { POST, GET };
}

/**
 * Create SolidStart handler with configurable redirect URLs
 * 
 * Supports two usage patterns:
 * 1. Pass a handler function from createMCPServer
 * 2. Pass config object directly (for inline configuration)
 * 
 * @param handlerOrOptions - Handler function from createMCPServer, or config options
 * @param redirectOptions - Redirect URL configuration (when first param is a handler)
 * @returns Object with GET, POST, PATCH, PUT, DELETE handlers
 * 
 * @example
 * **Pattern 1: Using serverClient from createMCPServer (Recommended)**
 * ```typescript
 * // lib/integrate-server.ts
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     }),
 *   ],
 * });
 * 
 * // src/routes/api/integrate/[...all].ts
 * import { toSolidStartHandler } from 'integrate-sdk/server';
 * import { serverClient } from '@/lib/integrate-server';
 * 
 * const handlers = toSolidStartHandler(serverClient, {
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * 
 * export const { GET, POST, PATCH, PUT, DELETE } = handlers;
 * ```
 * 
 * @example
 * **Pattern 2: Inline configuration**
 * ```typescript
 * // src/routes/api/integrate/[...all].ts
 * import { toSolidStartHandler } from 'integrate-sdk/server';
 * 
 * const handlers = toSolidStartHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * 
 * export const { GET, POST, PATCH, PUT, DELETE } = handlers;
 * ```
 */
export function toSolidStartHandler(
  clientOrHandlerOrOptions:
    | any  // Client instance from createMCPServer (with .handler property)
    | ((request: Request, context?: { params?: { action?: string; all?: string | string[] } }) => Promise<Response>)
    | {
      /** OAuth provider configurations */
      providers?: Record<string, {
        clientId: string;
        clientSecret: string;
        redirectUri?: string;
      }>;
      /** Server URL for MCP server */
      serverUrl?: string;
      /** API key for authentication */
      apiKey?: string;
      /** URL to redirect to after successful OAuth callback (default: '/') */
      redirectUrl?: string;
      /** URL to redirect to on OAuth error (default: '/auth-error') */
      errorRedirectUrl?: string;
    },
  _redirectOptions?: {
    /** URL to redirect to after successful OAuth callback (default: '/') */
    redirectUrl?: string;
    /** URL to redirect to on OAuth error (default: '/auth-error') */
    errorRedirectUrl?: string;
  }
) {
  // Pattern 1: Client instance provided (extract handler from it)
  if (clientOrHandlerOrOptions && (clientOrHandlerOrOptions as any).handler && typeof (clientOrHandlerOrOptions as any).handler === 'function') {
    const baseHandler = (clientOrHandlerOrOptions as any).handler;
    // _redirectOptions is ignored when passing a client (handler already has redirect logic)

    const handler = async (event: { request: Request }): Promise<Response> => {
      return baseHandler(event.request);
    };

    return {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
    };
  }

  // Pattern 2: Handler function provided (wrap it)
  if (typeof clientOrHandlerOrOptions === 'function') {
    const baseHandler = clientOrHandlerOrOptions;

    const handler = async (event: { request: Request }): Promise<Response> => {
      // Call the handler directly with request, like Astro does
      // Handler will extract route info from URL
      return baseHandler(event.request);
    };

    return {
      GET: handler,
      POST: handler,
      PATCH: handler,
      PUT: handler,
      DELETE: handler,
    };
  }

  // Pattern 3: Config object provided (create handler from scratch)
  const options = clientOrHandlerOrOptions;

  if (!options.providers || Object.keys(options.providers).length === 0) {
    throw new Error('toSolidStartHandler requires either a handler function or a providers config object');
  }

  // Create a minimal handler using the config
  const { providers, serverUrl, apiKey, redirectUrl, errorRedirectUrl } = options;

  // Create Next.js style handler with the config
  const nextHandler = createNextOAuthHandler({
    providers,
    serverUrl,
    apiKey,
  });

  // Get the catch-all handler routes
  const routes = nextHandler.toNextJsHandler({
    redirectUrl: redirectUrl || '/',
    errorRedirectUrl: errorRedirectUrl || '/auth-error',
  });

  // Return a SolidStart-compatible handler that wraps the Next.js routes
  const handler = async (event: { request: Request }): Promise<Response> => {
    const method = event.request.method.toUpperCase();
    const url = new URL(event.request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Extract the path segments after 'api/integrate'
    const integrateIndex = pathParts.indexOf('integrate');
    const segments = integrateIndex >= 0 ? pathParts.slice(integrateIndex + 1) : [];

    // Convert SolidStart event to Next.js-style context
    const context = {
      params: segments,
    };

    if (method === 'POST') {
      return routes.POST(event.request, { params: { all: context.params } });
    } else if (method === 'GET') {
      return routes.GET(event.request, { params: { all: context.params } });
    } else {
      return Response.json(
        { error: `Method ${method} not allowed` },
        { status: 405 }
      );
    }
  };

  return {
    GET: handler,
    POST: handler,
    PATCH: handler,
    PUT: handler,
    DELETE: handler,
  };
}

/**
 * Create SvelteKit handler with configurable redirect URLs
 * 
 * Supports two usage patterns:
 * 1. Pass a handler function from createMCPServer
 * 2. Pass config object directly (for inline configuration)
 * 
 * @param handlerOrOptions - Handler function from createMCPServer, or config options
 * @param redirectOptions - Redirect URL configuration (when first param is a handler)
 * @returns Handler function for SvelteKit routes
 * 
 * @example
 * **Pattern 1: Using serverClient from createMCPServer (Recommended)**
 * ```typescript
 * // lib/integrate-server.ts
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     }),
 *   ],
 * });
 * 
 * // routes/api/integrate/[...all]/+server.ts
 * import { toSvelteKitHandler } from 'integrate-sdk/server';
 * import { serverClient } from '$lib/integrate-server';
 * 
 * const svelteKitRoute = toSvelteKitHandler(serverClient, {
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * 
 * export const POST = svelteKitRoute;
 * export const GET = svelteKitRoute;
 * ```
 * 
 * @example
 * **Pattern 2: Inline configuration**
 * ```typescript
 * // routes/api/integrate/oauth/[...all]/+server.ts
 * import { toSvelteKitHandler } from 'integrate-sdk/server';
 * 
 * const handler = toSvelteKitHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 *   redirectUrl: '/dashboard',
 *   errorRedirectUrl: '/auth-error',
 * });
 * 
 * export const POST = handler;
 * export const GET = handler;
 * ```
 */
export function toSvelteKitHandler(
  clientOrHandlerOrOptions:
    | any  // Client instance from createMCPServer (with .handler property)
    | ((request: Request, context?: { params?: { action?: string; all?: string | string[] } }) => Promise<Response>)
    | {
      /** OAuth provider configurations */
      providers?: Record<string, {
        clientId: string;
        clientSecret: string;
        redirectUri?: string;
      }>;
      /** Server URL for MCP server */
      serverUrl?: string;
      /** API key for authentication */
      apiKey?: string;
      /** URL to redirect to after successful OAuth callback (default: '/') */
      redirectUrl?: string;
      /** URL to redirect to on OAuth error (default: '/auth-error') */
      errorRedirectUrl?: string;
    },
  _redirectOptions?: {
    /** URL to redirect to after successful OAuth callback (default: '/') */
    redirectUrl?: string;
    /** URL to redirect to on OAuth error (default: '/auth-error') */
    errorRedirectUrl?: string;
  }
) {
  // Pattern 1: Client instance provided (extract handler from it)
  if (clientOrHandlerOrOptions && (clientOrHandlerOrOptions as any).handler && typeof (clientOrHandlerOrOptions as any).handler === 'function') {
    const baseHandler = (clientOrHandlerOrOptions as any).handler;
    // _redirectOptions is ignored when passing a client (handler already has redirect logic)

    return async (event: any): Promise<Response> => {
      // Extract all param from SvelteKit event
      const all = event.params?.all;
      // Call the handler directly with request and context
      return baseHandler(event.request, { params: { all } });
    };
  }

  // Pattern 2: Handler function provided (wrap it)
  if (typeof clientOrHandlerOrOptions === 'function') {
    const baseHandler = clientOrHandlerOrOptions;

    return async (event: any): Promise<Response> => {
      // Extract all param from SvelteKit event
      const all = event.params?.all;
      // Call the handler directly with request and context, just like Astro does
      return baseHandler(event.request, { params: { all } });
    };
  }

  // Pattern 3: Config object provided (create handler from scratch)
  const options = clientOrHandlerOrOptions;

  if (!options.providers || Object.keys(options.providers).length === 0) {
    throw new Error('toSvelteKitHandler requires either a handler function or a providers config object');
  }

  // Create a minimal handler using the config
  const { providers, serverUrl, apiKey, redirectUrl, errorRedirectUrl } = options;

  // Create Next.js style handler with the config
  const nextHandler = createNextOAuthHandler({
    providers,
    serverUrl,
    apiKey,
  });

  // Get the catch-all handler routes
  const routes = nextHandler.toNextJsHandler({
    redirectUrl: redirectUrl || '/',
    errorRedirectUrl: errorRedirectUrl || '/auth-error',
  });

  // Return a SvelteKit-compatible handler that wraps the Next.js routes
  return async (event: any): Promise<Response> => {
    const method = event.request.method.toUpperCase();
    const all = event.params?.all;

    // Convert SvelteKit event to Next.js-style context
    const context = {
      params: Array.isArray(all) ? all : (all ? all.split('/').filter(Boolean) : []),
    };

    if (method === 'POST') {
      return routes.POST(event.request, { params: { all: context.params } });
    } else if (method === 'GET') {
      return routes.GET(event.request, { params: { all: context.params } });
    } else {
      return Response.json(
        { error: `Method ${method} not allowed` },
        { status: 405 }
      );
    }
  };
}

