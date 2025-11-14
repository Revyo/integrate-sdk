/**
 * SolidStart OAuth Route Adapter
 * Provides OAuth route handlers for SolidStart
 */

/**
 * Create SolidStart OAuth route handlers
 * 
 * Use this to create secure OAuth API routes in your SolidStart application
 * that handle authorization with server-side secrets.
 * 
 * @param baseHandler - Handler function from createMCPServer
 * @returns Object with GET, POST, PATCH, PUT, DELETE handlers
 * 
 * @example
 * ```typescript
 * // lib/integrate-server.ts
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * 
 * export const { client: serverClient, handler } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     }),
 *   ],
 * });
 * 
 * // src/routes/api/integrate/[...all].ts
 * import { toSolidStartHandler } from 'integrate-sdk/adapters/solid-start';
 * import { handler } from '@/lib/integrate-server';
 * 
 * const handlers = toSolidStartHandler(handler);
 * 
 * export const { GET, POST, PATCH, PUT, DELETE } = handlers;
 * ```
 */
export function toSolidStartHandler(baseHandler: (request: Request) => Promise<Response>) {
  const handler = async (event: { request: Request }): Promise<Response> => {
    return baseHandler(event.request);
  };

  return {
    GET: handler,
    POST: handler,
    PATCH: handler,
    PUT: handler,
    DELETE: handler,
  };
}
