/**
 * Fastify OAuth Route Adapter
 * Provides OAuth route handlers for Fastify
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring Fastify at build time
type FastifyRequest = any;
type FastifyReply = any;

/**
 * Create Fastify OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your Fastify application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with authorize, callback, status, and disconnect route handlers
 * 
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { toFastifyHandler } from 'integrate-sdk/adapters/fastify';
 * 
 * const fastify = Fastify({ logger: true });
 * const handler = toFastifyHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * fastify.route({
 *   method: 'POST',
 *   url: '/api/integrate/oauth/authorize',
 *   handler: handler.authorize
 * });
 * 
 * fastify.route({
 *   method: 'POST',
 *   url: '/api/integrate/oauth/callback',
 *   handler: handler.callback
 * });
 * 
 * fastify.route({
 *   method: 'GET',
 *   url: '/api/integrate/oauth/status',
 *   handler: handler.status
 * });
 * 
 * fastify.route({
 *   method: 'POST',
 *   url: '/api/integrate/oauth/disconnect',
 *   handler: handler.disconnect
 * });
 * ```
 */
export function toFastifyHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  return {
    /**
     * POST /api/integrate/oauth/authorize
     * Request authorization URL
     */
    authorize: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await handler.handleAuthorize(request.body);
        return reply.status(200).send(result);
      } catch (error: any) {
        console.error('[OAuth Authorize] Error:', error);
        return reply.status(500).send({ 
          error: error.message || 'Failed to get authorization URL' 
        });
      }
    },

    /**
     * POST /api/integrate/oauth/callback
     * Exchange authorization code for access token
     */
    callback: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await handler.handleCallback(request.body);
        return reply.status(200).send(result);
      } catch (error: any) {
        console.error('[OAuth Callback] Error:', error);
        return reply.status(500).send({ 
          error: error.message || 'Failed to exchange authorization code' 
        });
      }
    },

    /**
     * GET /api/integrate/oauth/status
     * Check authorization status
     */
    status: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const provider = (request.query as any).provider;
        const authHeader = request.headers.authorization;

        if (!provider) {
          return reply.status(400).send({ error: 'Missing provider query parameter' });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.status(400).send({ 
            error: 'Missing or invalid Authorization header' 
          });
        }

        const accessToken = authHeader.substring(7);
        const result = await handler.handleStatus(provider, accessToken);
        return reply.status(200).send(result);
      } catch (error: any) {
        console.error('[OAuth Status] Error:', error);
        return reply.status(500).send({ 
          error: error.message || 'Failed to check authorization status' 
        });
      }
    },

    /**
     * POST /api/integrate/oauth/disconnect
     * Revoke authorization for a provider
     */
    disconnect: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply.status(400).send({ 
            error: 'Missing or invalid Authorization header' 
          });
        }

        const accessToken = authHeader.substring(7);
        const { provider } = request.body as any;

        if (!provider) {
          return reply.status(400).send({ error: 'Missing provider in request body' });
        }

        const result = await handler.handleDisconnect({ provider }, accessToken);
        return reply.status(200).send(result);
      } catch (error: any) {
        console.error('[OAuth Disconnect] Error:', error);
        return reply.status(500).send({ 
          error: error.message || 'Failed to disconnect provider' 
        });
      }
    },
  };
}

