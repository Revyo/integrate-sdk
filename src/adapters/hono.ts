/**
 * Hono OAuth Route Adapter
 * Provides OAuth route handlers for Hono
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring Hono at build time
type HonoContext = any;

/**
 * Create Hono OAuth route handler
 * 
 * Use this to create secure OAuth API routes in your Hono application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Handler function for Hono routes
 * 
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { toHonoHandler } from 'integrate-sdk/adapters/hono';
 * 
 * const app = new Hono();
 * const handler = toHonoHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * app.on(['POST', 'GET'], '/api/auth/*', (c) => {
 *   return handler(c.req.raw);
 * });
 * ```
 */
export function toHonoHandler(config: OAuthHandlerConfig) {
  const oauthHandler = new OAuthHandler(config);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const action = segments[segments.length - 1];

    try {
      // Handle POST requests
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

      // Handle GET requests
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
}

