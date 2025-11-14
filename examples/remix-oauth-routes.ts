/**
 * Remix OAuth Routes Example
 * File: app/routes/api.auth.$.ts
 * 
 * This file should be placed in your Remix project's app/routes/ directory.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { OAuthHandler } from 'integrate-sdk';

// Create OAuth handler with provider configuration
const handler = new OAuthHandler({
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

// Handle POST requests (authorize, callback, disconnect)
export const action = async ({ request }: { request: Request }) => {
  return handler.handler(request);
};

// Handle GET requests (status)
export const loader = async ({ request }: { request: Request }) => {
  return handler.handler(request);
};

