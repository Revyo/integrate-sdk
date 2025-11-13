/**
 * SolidStart OAuth Route Adapter
 * Provides OAuth route handlers for SolidStart
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

/**
 * Create SolidStart OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your SolidStart application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with GET, POST, PATCH, PUT, DELETE handlers
 * 
 * @example
 * ```typescript
 * // src/routes/api/auth/[...all].ts
 * import { toSolidStartHandler } from 'integrate-sdk/adapters/solid-start';
 * 
 * const handlers = toSolidStartHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const { GET, POST, PATCH, PUT, DELETE } = handlers;
 * ```
 */
export function toSolidStartHandler(config: OAuthHandlerConfig) {
  const oauthHandler = new OAuthHandler(config);

  const handler = async (event: { request: Request }): Promise<Response> => {
    const { request } = event;
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    try {
      // Handle POST requests (authorize, callback, disconnect)
      if (request.method === 'POST') {
        if (action === 'authorize') {
          const body = await request.json();
          const result = await oauthHandler.handleAuthorize(body);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (action === 'callback') {
          const body = await request.json();
          const result = await oauthHandler.handleCallback(body);
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

          const result = await oauthHandler.handleDisconnect({ provider }, accessToken);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // Handle GET requests (status)
      if (request.method === 'GET' && action === 'status') {
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
        const result = await oauthHandler.handleStatus(provider, accessToken);
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
  };

  return {
    GET: handler,
    POST: handler,
    PATCH: handler,
    PUT: handler,
    DELETE: handler,
  };
}

