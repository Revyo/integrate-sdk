/**
 * TanStack Start OAuth Route Adapter
 * Provides OAuth route handlers for TanStack Start
 */

/**
 * Create TanStack Start OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your TanStack Start application
 * that handle authorization with server-side secrets.
 * 
 * @param handler - Handler function from createMCPServer
 * @returns Object with GET and POST handlers for catch-all routes
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient, handler } = createMCPServer({
 *   integrations: [
 *     githubIntegration({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     }),
 *   ],
 * });
 * 
 * // app/routes/api/integrate/$.ts
 * import { toTanStackStartHandler } from 'integrate-sdk/adapters/tanstack-start';
 * import { handler } from '@/lib/integrate-server';
 * 
 * const handlers = toTanStackStartHandler(handler);
 * 
 * export const Route = createFileRoute('/api/integrate/$')({
 *   server: {
 *     handlers: {
 *       GET: handlers.GET,
 *       POST: handlers.POST,
 *     },
 *   },
 * });
 * ```
 */
export function toTanStackStartHandler(handler: (request: Request) => Promise<Response>) {
  const baseHandler = async ({ request }: { request: Request }): Promise<Response> => {
    return handler(request);
  };

  return {
    GET: baseHandler,
    POST: baseHandler,
  };
}

// Backwards compatibility - for old OAuthHandlerConfig usage
export const createTanStackOAuthHandler = toTanStackStartHandler;

