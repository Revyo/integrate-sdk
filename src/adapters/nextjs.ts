/**
 * Next.js OAuth Route Adapter
 * Provides OAuth route handlers for Next.js App Router
 * 
 * Note: This file uses type imports only to avoid requiring Next.js at build time.
 * The actual Next.js types are used at runtime when available.
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring Next.js at build time
type NextRequest = any;
type NextResponse = any;

/**
 * Create Next.js OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your Next.js application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with authorize, callback, status, and disconnect route handlers, plus a unified handler
 * 
 * @example
 * **Simple Setup (Recommended)** - One route file handles everything:
 * 
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts
 * import { createNextOAuthHandler } from 'integrate-sdk';
 * 
 * const handler = createNextOAuthHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const { POST, GET } = handler.createRoutes();
 * ```
 * 
 * @example
 * **Advanced Setup** - Separate routes for each action:
 * 
 * ```typescript
 * // app/api/integrate/oauth/authorize/route.ts
 * export const POST = handler.authorize;
 * 
 * // app/api/integrate/oauth/callback/route.ts
 * export const POST = handler.callback;
 * 
 * // app/api/integrate/oauth/status/route.ts
 * export const GET = handler.status;
 * 
 * // app/api/integrate/oauth/disconnect/route.ts
 * export const POST = handler.disconnect;
 * ```
 */
export function createNextOAuthHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  const handlers = {
    /**
     * POST /api/integrate/oauth/authorize
     * 
     * Request authorization URL from MCP server with server-side OAuth credentials
     * 
     * Request body:
     * ```json
     * {
     *   "provider": "github",
     *   "scopes": ["repo", "user"],
     *   "state": "random-state-string",
     *   "codeChallenge": "pkce-code-challenge",
     *   "codeChallengeMethod": "S256",
     *   "redirectUri": "https://yourapp.com/oauth/callback"
     * }
     * ```
     * 
     * Response:
     * ```json
     * {
     *   "authorizationUrl": "https://github.com/login/oauth/authorize?..."
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // app/api/integrate/oauth/authorize/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *        *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const POST = handler.authorize;
     * ```
     */
    async authorize(req: NextRequest): Promise<NextResponse> {
      try {
        const body = await req.json();
        const result = await handler.handleAuthorize(body);
        return Response.json(result);
      } catch (error: any) {
        console.error('[OAuth Authorize] Error:', error);
        return Response.json(
          { error: error.message || 'Failed to get authorization URL' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/integrate/oauth/callback
     * 
     * Exchange authorization code for session token
     * 
     * Request body:
     * ```json
     * {
     *   "provider": "github",
     *   "code": "authorization-code",
     *   "codeVerifier": "pkce-code-verifier",
     *   "state": "state-from-authorize"
     * }
     * ```
     * 
     * Response:
     * ```json
     * {
     *   "sessionToken": "session-token-123",
     *   "provider": "github",
     *   "scopes": ["repo", "user"],
     *   "expiresAt": 1234567890
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // app/api/integrate/oauth/callback/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *        *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const POST = handler.callback;
     * ```
     */
    async callback(req: NextRequest): Promise<NextResponse> {
      try {
        const body = await req.json();
        const result = await handler.handleCallback(body);
        return Response.json(result);
      } catch (error: any) {
        console.error('[OAuth Callback] Error:', error);
        return Response.json(
          { error: error.message || 'Failed to exchange authorization code' },
          { status: 500 }
        );
      }
    },

    /**
     * GET /api/integrate/oauth/status?provider=github
     * 
     * Check if a provider is currently authorized
     * 
     * Query parameters:
     * - provider: Provider to check (e.g., "github")
     * 
     * Headers:
     * - Authorization: Bearer <access_token>
     * 
     * Response:
     * ```json
     * {
     *   "authorized": true,
     *   "scopes": ["repo", "user"],
     *   "expiresAt": "2025-11-06T00:32:08Z"
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // app/api/integrate/oauth/status/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *        *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const GET = handler.status;
     * ```
     */
    async status(req: NextRequest): Promise<NextResponse> {
      try {
        const provider = req.nextUrl.searchParams.get('provider');
        const authHeader = req.headers.get('authorization');

        if (!provider) {
          return Response.json(
            { error: 'Missing provider query parameter' },
            { status: 400 }
          );
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return Response.json(
            { error: 'Missing or invalid Authorization header' },
            { status: 400 }
          );
        }

        const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const result = await handler.handleStatus(provider, accessToken);
        return Response.json(result);
      } catch (error: any) {
        console.error('[OAuth Status] Error:', error);
        return Response.json(
          { error: error.message || 'Failed to check authorization status' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/integrate/oauth/disconnect
     * 
     * Revoke authorization for a specific provider
     * 
     * Request headers:
     * - Authorization: Bearer <access_token>
     * 
     * Request body:
     * ```json
     * {
     *   "provider": "github"
     * }
     * ```
     * 
     * Response:
     * ```json
     * {
     *   "success": true,
     *   "provider": "github"
     * }
     * ```
     * 
     * @example
     * ```typescript
     * // app/api/integrate/oauth/disconnect/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const POST = handler.disconnect;
     * ```
     */
    async disconnect(req: NextRequest): Promise<NextResponse> {
      try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return Response.json(
            { error: 'Missing or invalid Authorization header' },
            { status: 400 }
          );
        }

        const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const body = await req.json();
        const { provider } = body;

        if (!provider) {
          return Response.json(
            { error: 'Missing provider in request body' },
            { status: 400 }
          );
        }

        const result = await handler.handleDisconnect({ provider }, accessToken);
        return Response.json(result);
      } catch (error: any) {
        console.error('[OAuth Disconnect] Error:', error);
        return Response.json(
          { error: error.message || 'Failed to disconnect provider' },
          { status: 500 }
        );
      }
    },

    /**
     * Create unified route handlers for catch-all route
     * 
     * This is the simplest way to set up OAuth routes - create a single catch-all
     * route file that handles all OAuth actions.
     * 
     * @returns Object with POST and GET handlers for Next.js dynamic routes
     * 
     * @example
     * ```typescript
     * // app/api/integrate/oauth/[action]/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const { POST, GET } = handler.createRoutes();
     * ```
     */
    createRoutes() {
      return {
        /**
         * POST handler for authorize, callback, and disconnect actions
         */
        async POST(
          req: NextRequest,
          context: { params: { action: string } | Promise<{ action: string }> }
        ): Promise<NextResponse> {
          // Handle both Next.js 14 (sync params) and Next.js 15+ (async params)
          const params = context.params instanceof Promise ? await context.params : context.params;
          const action = params.action;

          if (action === 'authorize') {
            return handlers.authorize(req);
          }

          if (action === 'callback') {
            return handlers.callback(req);
          }

          if (action === 'disconnect') {
            return handlers.disconnect(req);
          }

          return Response.json(
            { error: `Unknown action: ${action}` },
            { status: 404 }
          );
        },

        /**
         * GET handler for status action
         */
        async GET(
          req: NextRequest,
          context: { params: { action: string } | Promise<{ action: string }> }
        ): Promise<NextResponse> {
          // Handle both Next.js 14 (sync params) and Next.js 15+ (async params)
          const params = context.params instanceof Promise ? await context.params : context.params;
          const action = params.action;

          if (action === 'status') {
            return handlers.status(req);
          }

          return Response.json(
            { error: `Unknown action: ${action}` },
            { status: 404 }
          );
        },
      };
    },

    /**
     * Create unified catch-all route handler
     * 
     * This is the simplest way to set up OAuth routes - create a single catch-all
     * route file that handles ALL OAuth actions including provider redirects.
     * 
     * @param redirectConfig - Configuration for OAuth redirect behavior
     * @returns Object with POST and GET handlers for Next.js catch-all routes
     * 
     * @example
     * ```typescript
     * // app/api/integrate/[...all]/route.ts
     * import { createNextOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createNextOAuthHandler({
     *   providers: {
     *     github: {
     *       clientId: process.env.GITHUB_CLIENT_ID!,
     *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
     *     },
     *   },
     * });
     * 
     * export const { POST, GET } = handler.toNextJsHandler({
     *   redirectUrl: '/',
     * });
     * ```
     * 
     * This single route file handles:
     * - POST /api/integrate/oauth/authorize - Get authorization URL
     * - POST /api/integrate/oauth/callback - Exchange code for token
     * - GET /api/integrate/oauth/callback - Provider OAuth redirect
     * - GET /api/integrate/oauth/status - Check authorization status
     * - POST /api/integrate/oauth/disconnect - Disconnect provider
     */
    toNextJsHandler(redirectConfig?: {
      /** URL to redirect to after OAuth callback (default: '/') */
      redirectUrl?: string;
      /** URL to redirect to on OAuth error (default: '/auth-error') */
      errorRedirectUrl?: string;
    }) {
      const defaultRedirectUrl = redirectConfig?.redirectUrl || '/';
      const errorRedirectUrl = redirectConfig?.errorRedirectUrl || '/auth-error';

      return {
        /**
         * POST handler for authorize, callback, and disconnect actions
         */
        async POST(
          req: NextRequest,
          context: { params: { all: string[] } | Promise<{ all: string[] }> }
        ): Promise<NextResponse> {
          // Handle both Next.js 14 (sync params) and Next.js 15+ (async params)
          const params = context.params instanceof Promise ? await context.params : context.params;
          const segments = params.all || [];

          // Routes: /api/integrate/oauth/[action]
          if (segments.length === 2 && segments[0] === 'oauth') {
            const action = segments[1];

            if (action === 'authorize') {
              return handlers.authorize(req);
            }

            if (action === 'callback') {
              return handlers.callback(req);
            }

            if (action === 'disconnect') {
              return handlers.disconnect(req);
            }

            return Response.json(
              { error: `Unknown action: ${action}` },
              { status: 404 }
            );
          }

          return Response.json(
            { error: `Invalid route: /${segments.join('/')}` },
            { status: 404 }
          );
        },

        /**
         * GET handler for status action and OAuth provider redirects
         */
        async GET(
          req: NextRequest,
          context: { params: { all: string[] } | Promise<{ all: string[] }> }
        ): Promise<NextResponse> {
          // Handle both Next.js 14 (sync params) and Next.js 15+ (async params)
          const params = context.params instanceof Promise ? await context.params : context.params;
          const segments = params.all || [];

          // Routes: /api/integrate/oauth/[action]
          if (segments.length === 2 && segments[0] === 'oauth') {
            const action = segments[1];

            // Status check
            if (action === 'status') {
              return handlers.status(req);
            }

            // OAuth provider redirect callback
            if (action === 'callback') {
              const { searchParams } = new URL(req.url);

              const code = searchParams.get('code');
              const state = searchParams.get('state');
              const error = searchParams.get('error');
              const errorDescription = searchParams.get('error_description');

              // Handle OAuth error
              if (error) {
                const errorMsg = errorDescription || error;
                console.error('[OAuth Redirect] Error:', errorMsg);

                return Response.redirect(
                  new URL(`${errorRedirectUrl}?error=${encodeURIComponent(errorMsg)}`, req.url)
                );
              }

              // Validate required parameters
              if (!code || !state) {
                console.error('[OAuth Redirect] Missing code or state parameter');

                return Response.redirect(
                  new URL(`${errorRedirectUrl}?error=${encodeURIComponent('Invalid OAuth callback')}`, req.url)
                );
              }

              // Extract returnUrl from state parameter (with fallbacks)
              let returnUrl = defaultRedirectUrl;

              try {
                // Try to parse state to extract returnUrl
                const { parseState } = await import('../oauth/pkce.js');
                const stateData = parseState(state);
                if (stateData.returnUrl) {
                  returnUrl = stateData.returnUrl;
                }
              } catch (e) {
                // If parsing fails, try to use referrer as fallback
                try {
                  const referrer = req.headers?.get?.('referer') || req.headers?.get?.('referrer');
                  if (referrer) {
                    const referrerUrl = new URL(referrer);
                    const currentUrl = new URL(req.url);

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
              const targetUrl = new URL(returnUrl, req.url);
              targetUrl.hash = `oauth_callback=${encodeURIComponent(JSON.stringify({ code, state }))}`;

              return Response.redirect(targetUrl);
            }

            return Response.json(
              { error: `Unknown action: ${action}` },
              { status: 404 }
            );
          }

          return Response.json(
            { error: `Invalid route: /${segments.join('/')}` },
            { status: 404 }
          );
        },
      };
    },
  };

  return handlers;
}

