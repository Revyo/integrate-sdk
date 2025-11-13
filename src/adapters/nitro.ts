/**
 * Nitro OAuth Route Adapter
 * Provides OAuth route handlers for Nitro
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring Nitro at build time
type H3Event = any;

/**
 * Create Nitro OAuth route handler
 * 
 * Use this to create secure OAuth API routes in your Nitro application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Handler function for Nitro routes
 * 
 * @example
 * ```typescript
 * // routes/api/integrate/oauth/[...all].ts
 * import { toNitroHandler } from 'integrate-sdk/adapters/nitro';
 * 
 * const handler = toNitroHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export default defineEventHandler(handler);
 * ```
 */
export function toNitroHandler(config: OAuthHandlerConfig) {
  const oauthHandler = new OAuthHandler(config);

  return async (event: H3Event): Promise<any> => {
    const request = event.node?.req || event.req || event;
    const url = new URL(request.url || '', `http://${request.headers?.host || 'localhost'}`);
    const segments = url.pathname.split('/').filter(Boolean);
    const action = segments[segments.length - 1];
    const method = request.method || event.method || 'GET';

    try {
      // Handle POST requests
      if (method === 'POST') {
        if (action === 'authorize') {
          const body = await (event.readBody ? event.readBody() : readBody(event));
          const result = await oauthHandler.handleAuthorize(body);
          return result;
        }

        if (action === 'callback') {
          const body = await (event.readBody ? event.readBody() : readBody(event));
          const result = await oauthHandler.handleCallback(body);
          return result;
        }

        if (action === 'disconnect') {
          const authHeader = event.headers?.get?.('authorization') || 
                            request.headers?.authorization;
          
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw createError({
              statusCode: 400,
              message: 'Missing or invalid Authorization header'
            });
          }

          const accessToken = authHeader.substring(7);
          const body = await (event.readBody ? event.readBody() : readBody(event));
          const { provider } = body;

          if (!provider) {
            throw createError({
              statusCode: 400,
              message: 'Missing provider in request body'
            });
          }

          const result = await oauthHandler.handleDisconnect({ provider }, accessToken);
          return result;
        }
      }

      // Handle GET requests
      if (method === 'GET' && action === 'status') {
        const provider = url.searchParams.get('provider');
        const authHeader = event.headers?.get?.('authorization') || 
                          request.headers?.authorization;

        if (!provider) {
          throw createError({
            statusCode: 400,
            message: 'Missing provider query parameter'
          });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw createError({
            statusCode: 400,
            message: 'Missing or invalid Authorization header'
          });
        }

        const accessToken = authHeader.substring(7);
        const result = await oauthHandler.handleStatus(provider, accessToken);
        return result;
      }

      throw createError({
        statusCode: 404,
        message: `Unknown action: ${action}`
      });
    } catch (error: any) {
      console.error(`[OAuth ${action}] Error:`, error);
      throw createError({
        statusCode: error.statusCode || 500,
        message: error.message || 'Internal server error'
      });
    }
  };
}

// Helper functions for compatibility
function readBody(event: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    const req = event.node?.req || event.req || event;
    req.on('data', (chunk: any) => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function createError(options: { statusCode: number; message: string }): Error {
  const error = new Error(options.message) as any;
  error.statusCode = options.statusCode;
  return error;
}

