/**
 * Remix OAuth Routes Example
 * Demonstrates how to set up OAuth routes in Remix
 * 
 * Create separate files for each action:
 * - app/routes/api.integrate.oauth.authorize.ts
 * - app/routes/api.integrate.oauth.callback.ts
 * - app/routes/api.integrate.oauth.status.ts
 * - app/routes/api.integrate.oauth.disconnect.ts
 */

import { toRemixHandler } from 'integrate-sdk/adapters/remix';

// Shared OAuth handler configuration
const handler = toRemixHandler({
  providers: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/integrate/oauth/callback',
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/integrate/oauth/callback',
    },
  },
});

// ===== File: app/routes/api.integrate.oauth.authorize.ts =====
export const action = handler.authorize;

// ===== File: app/routes/api.integrate.oauth.callback.ts =====
// export const action = handler.callback;

// ===== File: app/routes/api.integrate.oauth.status.ts =====
// export const loader = handler.status;

// ===== File: app/routes/api.integrate.oauth.disconnect.ts =====
// export const action = handler.disconnect;

