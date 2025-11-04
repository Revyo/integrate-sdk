/**
 * TanStack Start OAuth Route Adapter
 * Provides OAuth route handlers for TanStack Start
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

/**
 * Create TanStack Start OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your TanStack Start application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with MCP server URL and provider credentials
 * @returns Object with authorize, callback, and status route handlers
 * 
 * @example
 * ```typescript
 * // app/routes/api/integrate/oauth/authorize.ts
 * import { createTanStackOAuthHandler } from 'integrate-sdk';
 * import { json } from '@tanstack/start';
 * 
 * const handler = createTanStackOAuthHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *     gmail: {
 *       clientId: process.env.GMAIL_CLIENT_ID!,
 *       clientSecret: process.env.GMAIL_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const POST = handler.authorize;
 * ```
 */
export function createTanStackOAuthHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  return {
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
     * // app/routes/api/integrate/oauth/authorize.ts
     * import { createTanStackOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createTanStackOAuthHandler({
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
    async authorize({ request }: { request: Request }): Promise<Response> {
      try {
        const body = await request.json();
        const result = await handler.handleAuthorize(body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error: any) {
        console.error('[OAuth Authorize] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to get authorization URL' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
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
     * // app/routes/api/integrate/oauth/callback.ts
     * import { createTanStackOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createTanStackOAuthHandler({
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
    async callback({ request }: { request: Request }): Promise<Response> {
      try {
        const body = await request.json();
        const result = await handler.handleCallback(body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error: any) {
        console.error('[OAuth Callback] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to exchange authorization code' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
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
     * // app/routes/api/integrate/oauth/status.ts
     * import { createTanStackOAuthHandler } from 'integrate-sdk';
     * 
     * const handler = createTanStackOAuthHandler({
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
    async status({ request }: { request: Request }): Promise<Response> {
      try {
        const url = new URL(request.url);
        const provider = url.searchParams.get('provider');
        const sessionToken = request.headers.get('x-session-token');

        if (!provider) {
          return new Response(
            JSON.stringify({ error: 'Missing provider query parameter' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        if (!sessionToken) {
          return new Response(
            JSON.stringify({ error: 'Missing X-Session-Token header' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );
        }

        const result = await handler.handleStatus(provider, sessionToken);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error: any) {
        console.error('[OAuth Status] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to check authorization status' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
      }
    },
  };
}

