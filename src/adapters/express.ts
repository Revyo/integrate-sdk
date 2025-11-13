/**
 * Express OAuth Route Adapter
 * Provides OAuth route handlers for Express
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring Express at build time
type ExpressRequest = any;
type ExpressResponse = any;
type ExpressNextFunction = any;

/**
 * Create Express OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your Express application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with authorize, callback, status, and disconnect route handlers
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { toExpressHandler } from 'integrate-sdk/adapters/express';
 * 
 * const app = express();
 * const handler = toExpressHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * app.post('/api/integrate/oauth/authorize', handler.authorize);
 * app.post('/api/integrate/oauth/callback', handler.callback);
 * app.get('/api/integrate/oauth/status', handler.status);
 * app.post('/api/integrate/oauth/disconnect', handler.disconnect);
 * ```
 */
export function toExpressHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  return {
    /**
     * POST /api/integrate/oauth/authorize
     * Request authorization URL
     */
    authorize: async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
      try {
        const result = await handler.handleAuthorize(req.body);
        res.status(200).json(result);
      } catch (error: any) {
        console.error('[OAuth Authorize] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to get authorization URL' });
      }
    },

    /**
     * POST /api/integrate/oauth/callback
     * Exchange authorization code for access token
     */
    callback: async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
      try {
        const result = await handler.handleCallback(req.body);
        res.status(200).json(result);
      } catch (error: any) {
        console.error('[OAuth Callback] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to exchange authorization code' });
      }
    },

    /**
     * GET /api/integrate/oauth/status
     * Check authorization status
     */
    status: async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
      try {
        const provider = req.query.provider as string;
        const authHeader = req.headers.authorization;

        if (!provider) {
          res.status(400).json({ error: 'Missing provider query parameter' });
          return;
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(400).json({ error: 'Missing or invalid Authorization header' });
          return;
        }

        const accessToken = authHeader.substring(7);
        const result = await handler.handleStatus(provider, accessToken);
        res.status(200).json(result);
      } catch (error: any) {
        console.error('[OAuth Status] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to check authorization status' });
      }
    },

    /**
     * POST /api/integrate/oauth/disconnect
     * Revoke authorization for a provider
     */
    disconnect: async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.status(400).json({ error: 'Missing or invalid Authorization header' });
          return;
        }

        const accessToken = authHeader.substring(7);
        const { provider } = req.body;

        if (!provider) {
          res.status(400).json({ error: 'Missing provider in request body' });
          return;
        }

        const result = await handler.handleDisconnect({ provider }, accessToken);
        res.status(200).json(result);
      } catch (error: any) {
        console.error('[OAuth Disconnect] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to disconnect provider' });
      }
    },
  };
}

