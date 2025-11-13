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
 * @param config - OAuth handler configuration with provider credentials
 * @returns Object with GET and POST handlers for catch-all routes
 * 
 * @example
 * ```typescript
 * // app/routes/api/auth/$.ts
 * import { toTanStackStartHandler } from 'integrate-sdk/adapters/tanstack-start';
 * import { createFileRoute } from '@tanstack/react-router';
 * 
 * const handler = toTanStackStartHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const Route = createFileRoute('/api/auth/$')({
 *   server: {
 *     handlers: {
 *       GET: handler.GET,
 *       POST: handler.POST,
 *     },
 *   },
 * });
 * ```
 */
export function toTanStackStartHandler(config: OAuthHandlerConfig) {
  const handler = new OAuthHandler(config);

  const baseHandler = async ({ request }: { request: Request }): Promise<Response> => {
    return handler.handler(request);
  };

  return {
    GET: baseHandler,
    POST: baseHandler,
  };
}

// Backwards compatibility
export const createTanStackOAuthHandler = toTanStackStartHandler;

