/**
 * SvelteKit OAuth Route Adapter
 * Provides OAuth route handlers for SvelteKit
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

// Type-only imports to avoid requiring SvelteKit at build time
type RequestEvent = any;
type ResolveFunction = any;

/**
 * Create SvelteKit OAuth route handler for hooks
 * 
 * Use this to integrate OAuth handling into your SvelteKit hooks.server.ts
 * 
 * @param event - SvelteKit RequestEvent
 * @param resolve - SvelteKit resolve function
 * @param handler - OAuth handler instance
 * @param basePath - Base path for OAuth routes (default: '/api/integrate/oauth')
 * @returns Response from OAuth handler or resolved request
 * 
 * @example
 * ```typescript
 * // hooks.server.ts
 * import { svelteKitHandler, toSvelteKitHandler } from 'integrate-sdk/adapters/svelte-kit';
 * 
 * const handler = toSvelteKitHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export async function handle({ event, resolve }) {
 *   return svelteKitHandler({ event, resolve, handler });
 * }
 * ```
 */
export async function svelteKitHandler({
    event,
    resolve,
    handler,
    basePath = '/api/integrate/oauth',
}: {
    event: RequestEvent;
    resolve: ResolveFunction;
    handler: ReturnType<typeof toSvelteKitHandler>;
    basePath?: string;
}): Promise<Response> {
    const { request, url } = event;

    // Check if this is an OAuth path
    const baseUrl = new URL(basePath, url.origin);
    if (!url.pathname.startsWith(baseUrl.pathname)) {
        return resolve(event);
    }

    // Handle OAuth request
    return handler(event);
}

/**
 * Create SvelteKit OAuth route handler
 * 
 * Use this to create secure OAuth API routes in your SvelteKit application
 * that handle authorization with server-side secrets.
 * 
 * @param config - OAuth handler configuration with provider credentials
 * @returns Handler function for SvelteKit routes
 * 
 * @example
 * ```typescript
 * // routes/api/integrate/oauth/[...all]/+server.ts
 * import { toSvelteKitHandler } from 'integrate-sdk/adapters/svelte-kit';
 * 
 * const handler = toSvelteKitHandler({
 *   providers: {
 *     github: {
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     },
 *   },
 * });
 * 
 * export const POST = handler;
 * export const GET = handler;
 * ```
 */
export function toSvelteKitHandler(config: OAuthHandlerConfig) {
    const oauthHandler = new OAuthHandler(config);

    return async (event: RequestEvent): Promise<Response> => {
        const { request } = event;
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

