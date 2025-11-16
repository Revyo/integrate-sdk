/**
 * Example: Next.js Catch-All OAuth Route (Simplified with Server Config)
 * 
 * This example shows the SIMPLEST way to set up OAuth routes.
 * Define your providers once in a server config file, then just import
 * the catch-all route handlers in your route file.
 */

/**
 * Step 1: Create server config file
 * File: lib/integrate-server.ts
 */
// import { createMCPServer, githubIntegration, gmailIntegration } from 'integrate-sdk/server';
// 
// export const { client: serverClient } = createMCPServer({
//   apiKey: process.env.INTEGRATE_API_KEY,
//   integrations: [
//     githubIntegration({
//       clientId: process.env.GITHUB_CLIENT_ID!,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
//       scopes: ['repo', 'user'],
//     }),
//     gmailIntegration({
//       clientId: process.env.GMAIL_CLIENT_ID!,
//       clientSecret: process.env.GMAIL_CLIENT_SECRET!,
//       scopes: ['gmail.readonly'],
//     }),
//   ],
// });

/**
 * Step 2: Create single catch-all route file
 * File: app/api/integrate/[...all]/route.ts
 * 
 * This is literally all you need! Just import serverClient and toNextJsHandler.
 */
// import { serverClient } from '@/lib/integrate-server';
// import { toNextJsHandler } from 'integrate-sdk/server';
//
// export const { POST, GET } = toNextJsHandler(serverClient, {
//   redirectUrl: '/dashboard',
//   errorRedirectUrl: '/auth-error',
// });

/**
 * That's it! This single route file now handles ALL OAuth operations:
 * - POST /api/integrate/oauth/authorize - Get authorization URL
 * - POST /api/integrate/oauth/callback - Exchange code for token
 * - GET /api/integrate/oauth/callback - Provider OAuth redirect
 * - GET /api/integrate/oauth/status - Check authorization status
 * - POST /api/integrate/oauth/disconnect - Disconnect provider
 */

/**
 * BEFORE (Required 2+ separate files):
 * 
 * 1. app/oauth/callback/route.ts - Provider redirects
 * 2. app/api/integrate/oauth/[action]/route.ts - API routes
 * 
 * AFTER (Only 2 simple files):
 * 
 * 1. lib/integrate-server.ts - Define providers once
 * 2. app/api/integrate/[...all]/route.ts - Import and export routes
 */

// Export types for TypeScript
export { };


