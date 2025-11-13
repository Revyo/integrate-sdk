/**
 * Waku OAuth Route Adapter
 * Provides OAuth route handlers for Waku
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

/**
 * Create Waku OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your Waku application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with GET and POST handlers for Waku routes
 * 
 * @example
 * ```typescript
 * // src/pages/api/auth/[...route].ts
 * import { toWakuHandler } from 'integrate-sdk/adapters/waku';
 * 
 * const handlers = toWakuHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const GET = handlers.GET;
 * export const POST = handlers.POST;
 * ```
 */
export function toWakuHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  return {
    /**
     * POST handler for authorize, callback, and disconnect actions
     */
    POST: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const action = segments[segments.length - 1];

      try {
        if (action === 'authorize') {
          const body = await request.json();
          const result = await handler.handleAuthorize(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (action === 'callback') {
          const body = await request.json();
          const result = await handler.handleCallback(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (action === 'disconnect') {
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
        }

        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error: any) {
        console.error(`[OAuth ${action}] Error:`, error);
        return new Response(
          JSON.stringify({ error: error.message || 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },

    /**
     * GET handler for status action
     */
    GET: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const segments = url.pathname.split('/').filter(Boolean);
      const action = segments[segments.length - 1];

      try {
        if (action === 'status') {
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
        }

        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error: any) {
        console.error(`[OAuth ${action}] Error:`, error);
        return new Response(
          JSON.stringify({ error: error.message || 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },
  };
}

