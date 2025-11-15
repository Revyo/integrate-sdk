/**
 * SvelteKit OAuth Example
 * File: src/routes/api/integrate/oauth/[...all]/+server.ts
 * 
 * This file should be placed in your SvelteKit project.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { toSvelteKitHandler } from 'integrate-sdk/adapters/svelte-kit';

// Pattern 1: Using serverClient (Recommended)
// import { serverClient } from '$lib/integrate-server';
// const svelteKitRoute = toSvelteKitHandler(serverClient, {
//   redirectUrl: '/dashboard',
//   errorRedirectUrl: '/auth-error',
// });
// export const POST = svelteKitRoute;
// export const GET = svelteKitRoute;

// Pattern 2: Inline configuration
const handler = toSvelteKitHandler({
  providers: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:5173/api/integrate/oauth/callback',
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      redirectUri: 'http://localhost:5173/api/integrate/oauth/callback',
    },
  },
  redirectUrl: '/dashboard',
  errorRedirectUrl: '/auth-error',
});

// Export handlers for both GET and POST requests
export const POST = handler;
export const GET = handler;

/**
 * Alternative: Using Hooks
 * File: src/hooks.server.ts
 * 
 * You can also integrate OAuth handling into your hooks:
 * 
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
 *   return svelteKitHandler({ 
 *     event, 
 *     resolve, 
 *     handler,
 *     basePath: '/api/integrate/oauth'
 *   });
 * }
 */

