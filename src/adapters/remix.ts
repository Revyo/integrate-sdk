/**
 * Remix OAuth Route Adapter
 * Provides OAuth route handlers for Remix
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

/**
 * Create Remix OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your Remix application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with action and loader functions for Remix routes
 * 
 * @example
 * ```typescript
 * // app/routes/api.integrate.oauth.authorize.ts
 * import { toRemixHandler } from 'integrate-sdk/adapters/remix';
 * 
 * const handler = toRemixHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const action = handler.authorize;
 * ```
 */
export function toRemixHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  return {
    /**
     * Action for authorize endpoint
     * POST /api/integrate/oauth/authorize
     */
    authorize: async ({ request }: { request: Request }) => {
      try {
        const body = await request.json();
        const result = await handler.handleAuthorize(body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('[OAuth Authorize] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to get authorization URL' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },

    /**
     * Action for callback endpoint
     * POST /api/integrate/oauth/callback
     */
    callback: async ({ request }: { request: Request }) => {
      try {
        const body = await request.json();
        const result = await handler.handleCallback(body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('[OAuth Callback] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to exchange authorization code' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },

    /**
     * Loader for status endpoint
     * GET /api/integrate/oauth/status
     */
    status: async ({ request }: { request: Request }) => {
      try {
        const url = new URL(request.url);
        const provider = url.searchParams.get('provider');
        const authHeader = request.headers.get('authorization');

        if (!provider) {
          return new Response(
            JSON.stringify({ error: 'Missing provider query parameter' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Missing or invalid Authorization header' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const accessToken = authHeader.substring(7);
        const result = await handler.handleStatus(provider, accessToken);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('[OAuth Status] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to check authorization status' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },

    /**
     * Action for disconnect endpoint
     * POST /api/integrate/oauth/disconnect
     */
    disconnect: async ({ request }: { request: Request }) => {
      try {
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return new Response(
            JSON.stringify({ error: 'Missing or invalid Authorization header' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const accessToken = authHeader.substring(7);
        const body = await request.json();
        const { provider } = body;

        if (!provider) {
          return new Response(
            JSON.stringify({ error: 'Missing provider in request body' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const result = await handler.handleDisconnect({ provider }, accessToken);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error: any) {
        console.error('[OAuth Disconnect] Error:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to disconnect provider' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },
  };
}

