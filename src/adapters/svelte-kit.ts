/**
 * SvelteKit OAuth Route Adapter
 * Provides OAuth route handlers for SvelteKit
 */

// Type-only imports to avoid requiring SvelteKit at build time
type RequestEvent = any;
type ResolveFunction = any;

/**
 * Create SvelteKit OAuth route handler for hooks
 * 
 * Use this to integrate OAuth handling into your SvelteKit hooks.server.ts
 * 
 * @param authConfig - Handler function from createMCPServer
 * @param event - SvelteKit RequestEvent
 * @param resolve - SvelteKit resolve function
 * @param basePath - Base path for OAuth routes (default: '/api/auth')
 * @returns Response from OAuth handler or resolved request
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
 * // hooks.server.ts
 * import { svelteKitHandler } from 'integrate-sdk/adapters/svelte-kit';
 * import { handler } from '$lib/integrate-server';
 * 
 * export async function handle({ event, resolve }) {
 *   return svelteKitHandler({ authConfig: handler, event, resolve });
 * }
 * ```
 */
export async function svelteKitHandler({
    authConfig,
    event,
    resolve,
    basePath = '/api/auth',
}: {
    authConfig: (request: Request) => Promise<Response>;
    event: RequestEvent;
    resolve: ResolveFunction;
    basePath?: string;
}): Promise<Response> {
    const { url } = event;

    // Check if this is an OAuth path
    const baseUrl = new URL(basePath, url.origin);
    if (!url.pathname.startsWith(baseUrl.pathname)) {
        return resolve(event);
    }

    // Handle OAuth request
    return authConfig(event.request);
}

/**
 * Create SvelteKit OAuth route handler
 * 
 * Use this to create secure OAuth API routes in your SvelteKit application
 * that handle authorization with server-side secrets.
 * 
 * @param baseHandler - Handler function from createMCPServer
 * @returns Handler function for SvelteKit routes
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
 * // routes/api/auth/[...all]/+server.ts
 * import { toSvelteKitHandler } from 'integrate-sdk/adapters/svelte-kit';
 * import { handler } from '$lib/integrate-server';
 * 
 * const svelteKitRoute = toSvelteKitHandler(handler);
 * 
 * export const POST = svelteKitRoute;
 * export const GET = svelteKitRoute;
 * ```
 */
export function toSvelteKitHandler(baseHandler: (request: Request) => Promise<Response>) {
    return async (event: RequestEvent): Promise<Response> => {
        return baseHandler(event.request);
    };
}

