/**
 * NestJS OAuth Route Adapter
 * Provides OAuth route handlers for NestJS
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring NestJS at build time
type NestRequest = any;
type NestResponse = any;

/**
 * Create NestJS OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your NestJS application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with authorize, callback, status, and disconnect route handlers
 * 
 * @example
 * ```typescript
 * // auth.controller.ts
 * import { Controller, Post, Get, Req, Res, Query, Body } from '@nestjs/common';
 * import { toNestJsHandler } from 'integrate-sdk/adapters/nestjs';
 * 
 * @Controller('api/integrate/oauth')
 * export class OAuthController {
 *   private handler = toNestJsHandler({
 *     providers: {
 *       github: {
 *         clientId: process.env.GITHUB_CLIENT_ID!,
 *         clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       },
 *     },
 *   });
 * 
 *   @Post('authorize')
 *   authorize(@Req() req: Request, @Res() res: Response) {
 *     return this.handler.authorize(req, res);
 *   }
 * 
 *   @Post('callback')
 *   callback(@Req() req: Request, @Res() res: Response) {
 *     return this.handler.callback(req, res);
 *   }
 * 
 *   @Get('status')
 *   status(@Req() req: Request, @Res() res: Response) {
 *     return this.handler.status(req, res);
 *   }
 * 
 *   @Post('disconnect')
 *   disconnect(@Req() req: Request, @Res() res: Response) {
 *     return this.handler.disconnect(req, res);
 *   }
 * }
 * ```
 */
export function toNestJsHandler(config: OAuthHandlerConfig) {
    const handler = new OAuthHandler(config);

    return {
        /**
         * POST /api/integrate/oauth/authorize
         * Request authorization URL
         */
        authorize: async (req: NestRequest, res: NestResponse) => {
            try {
                const result = await handler.handleAuthorize(req.body);
                return res.status(200).json(result);
            } catch (error: any) {
                console.error('[OAuth Authorize] Error:', error);
                return res.status(500).json({
                    error: error.message || 'Failed to get authorization URL'
                });
            }
        },

        /**
         * POST /api/integrate/oauth/callback
         * Exchange authorization code for access token
         */
        callback: async (req: NestRequest, res: NestResponse) => {
            try {
                const result = await handler.handleCallback(req.body);
                return res.status(200).json(result);
            } catch (error: any) {
                console.error('[OAuth Callback] Error:', error);
                return res.status(500).json({
                    error: error.message || 'Failed to exchange authorization code'
                });
            }
        },

        /**
         * GET /api/integrate/oauth/status
         * Check authorization status
         */
        status: async (req: NestRequest, res: NestResponse) => {
            try {
                const provider = req.query?.provider;
                const authHeader = req.headers?.authorization;

                if (!provider) {
                    return res.status(400).json({ error: 'Missing provider query parameter' });
                }

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(400).json({
                        error: 'Missing or invalid Authorization header'
                    });
                }

                const accessToken = authHeader.substring(7);
                const result = await handler.handleStatus(provider, accessToken);
                return res.status(200).json(result);
            } catch (error: any) {
                console.error('[OAuth Status] Error:', error);
                return res.status(500).json({
                    error: error.message || 'Failed to check authorization status'
                });
            }
        },

        /**
         * POST /api/integrate/oauth/disconnect
         * Revoke authorization for a provider
         */
        disconnect: async (req: NestRequest, res: NestResponse) => {
            try {
                const authHeader = req.headers?.authorization;

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(400).json({
                        error: 'Missing or invalid Authorization header'
                    });
                }

                const accessToken = authHeader.substring(7);
                const { provider } = req.body;

                if (!provider) {
                    return res.status(400).json({ error: 'Missing provider in request body' });
                }

                const result = await handler.handleDisconnect({ provider }, accessToken);
                return res.status(200).json(result);
            } catch (error: any) {
                console.error('[OAuth Disconnect] Error:', error);
                return res.status(500).json({
                    error: error.message || 'Failed to disconnect provider'
                });
            }
        },
    };
}

