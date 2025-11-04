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
 * @returns Object with authorize, callback, and status route handlers, plus a unified handler
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
     * - X-Session-Token: Session token from previous authorization
     * 
     * Response:
     * ```json
     * {
     *   "authorized": true,
     *   "provider": "github",
     *   "scopes": ["repo", "user"],
     *   "expiresAt": 1234567890
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
        const sessionToken = req.headers.get('x-session-token');

        if (!provider) {
          return Response.json(
            { error: 'Missing provider query parameter' },
            { status: 400 }
          );
        }

        if (!sessionToken) {
          return Response.json(
            { error: 'Missing X-Session-Token header' },
            { status: 400 }
          );
        }

        const result = await handler.handleStatus(provider, sessionToken);
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
         * POST handler for authorize and callback actions
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
  };

  return handlers;
}

