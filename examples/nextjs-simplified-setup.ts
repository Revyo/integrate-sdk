/**
 * Complete Example: Simplified Next.js OAuth Setup
 * 
 * This shows the COMPLETE setup for OAuth in Next.js with the new
 * simplified catch-all route approach.
 */

// =============================================================================
// FILE 1: lib/integrate-server.ts
// =============================================================================
// Define your OAuth providers ONCE in a server config file

import { createMCPServer, githubPlugin, gmailPlugin } from 'integrate-sdk/server';

// Plugins automatically use GITHUB_CLIENT_ID, GMAIL_CLIENT_ID, etc. from environment
export const { client: serverClient } = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  plugins: [
    githubPlugin({
      scopes: ['repo', 'user'],
    }),
    gmailPlugin({
      scopes: ['gmail.readonly'],
    }),
  ],
});

// =============================================================================
// FILE 2: app/api/integrate/[...all]/route.ts
// =============================================================================
// Single catch-all route that handles ALL OAuth operations

import { serverClient } from '@/lib/integrate-server';
import { toNextJsHandler } from 'integrate-sdk/server';

// Just pass the serverClient and options separately!
export const { POST, GET } = toNextJsHandler(serverClient, {
  redirectUrl: '/dashboard',        // Where to redirect after OAuth success
  errorRedirectUrl: '/auth-error',  // Where to redirect on OAuth error
});

// Alternative: Provide config inline without importing
// export const { POST, GET } = toNextJsHandler({
//   providers: {
//     github: {
//       clientId: process.env.GITHUB_CLIENT_ID!,
//       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
//       redirectUri: process.env.GITHUB_REDIRECT_URI,
//     },
//   },
//   redirectUrl: '/dashboard',
//   errorRedirectUrl: '/auth-error',
// });

// This single file now handles:
// - POST /api/integrate/oauth/authorize    → Get authorization URL
// - POST /api/integrate/oauth/callback     → Exchange code for token (client call)
// - GET  /api/integrate/oauth/callback     → Provider OAuth redirect
// - GET  /api/integrate/oauth/status       → Check authorization status
// - POST /api/integrate/oauth/disconnect   → Disconnect provider

// =============================================================================
// FILE 3: app/api/repos/route.ts (Example server-side API route)
// =============================================================================
// Use the server client in your API routes

import { serverClient } from '@/lib/integrate-server';

export async function GET() {
  try {
    // Automatically connects on first call - no manual setup needed!
    const repos = await serverClient.github.listOwnRepos({ per_page: 10 });
    return Response.json({ repos });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// =============================================================================
// FILE 3: lib/integrate.ts (Client-side configuration)
// =============================================================================
// Create a shared client instance for use across your app

import { createMCPClient, githubPlugin } from 'integrate-sdk';

export const client = createMCPClient({
  plugins: [
    githubPlugin({
      scopes: ['repo', 'user'],
      // No clientId or clientSecret needed on client!
    }),
  ],
  oauthFlow: { mode: 'popup' },
});

// =============================================================================
// FILE 4: app/components/GitHubConnect.tsx (Example client component)
// =============================================================================
// Use the client SDK in your React components

'use client';

import { client } from '@/lib/integrate';
import { useState, useEffect } from 'react';

export function GitHubConnect() {

  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Check if already authorized
    client.isAuthorized('github').then(setAuthorized);
  }, [client]);

  const handleAuthorize = async () => {
    try {
      await client.authorize('github');
      setAuthorized(true);
    } catch (error) {
      console.error('Authorization failed:', error);
    }
  };

  const handleCreateIssue = async () => {
    try {
      const result = await client.github.createIssue({
        owner: 'owner',
        repo: 'repo',
        title: 'Test issue',
        body: 'Created from Integrate SDK',
      });
      console.log('Issue created:', result);
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  return (
    <div>
    {
      authorized?(
        <button onClick = { handleCreateIssue } > Create Issue</ button >
      ) : (
    <button onClick= { handleAuthorize } > Connect GitHub </button>
      )
}
</div>
  );
}

// =============================================================================
// SETUP SUMMARY
// =============================================================================

/**
 * BEFORE (Old Method - Required 3+ files):
 * 
 * 1. lib/integrate-server.ts
 *    - Define server config with OAuth secrets
 * 
 * 2. app/oauth/callback/route.ts
 *    - Handle provider OAuth redirects
 * 
 * 3. app/api/integrate/oauth/[action]/route.ts
 *    - Handle API OAuth operations (authorize, callback, status, disconnect)
 * 
 * Total: 3 files minimum for OAuth setup
 */

/**
 * AFTER (New Method - Only 2 files):
 * 
 * 1. lib/integrate-server.ts
 *    - Define server config with OAuth secrets (same as before)
 * 
 * 2. app/api/integrate/[...all]/route.ts
 *    - Single catch-all route handles EVERYTHING
 * 
 * Total: 2 files for complete OAuth setup!
 * 
 * BENEFITS:
 * ✅ 33% fewer files
 * ✅ Define providers only once
 * ✅ Simpler to maintain
 * ✅ No code duplication
 * ✅ All OAuth logic in one place
 */

/**
 * ENVIRONMENT VARIABLES NEEDED (.env.local):
 * 
 * GITHUB_CLIENT_ID=your_github_client_id
 * GITHUB_CLIENT_SECRET=your_github_client_secret
 * GMAIL_CLIENT_ID=your_gmail_client_id
 * GMAIL_CLIENT_SECRET=your_gmail_client_secret
 */

/**
 * OAUTH PROVIDER REDIRECT URL SETUP:
 * 
 * Configure in your OAuth provider settings (GitHub, Google, etc.):
 * 
 * Development:  http://localhost:3000/api/integrate/oauth/callback
 * Production:   https://yourapp.com/api/integrate/oauth/callback
 */

export { };

