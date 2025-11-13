/**
 * Nuxt OAuth Example
 * File: server/api/auth/[...all].ts
 * 
 * This file should be placed in your Nuxt project's server/api/ directory.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { OAuthHandler } from 'integrate-sdk';

// Create the OAuth handler with your provider configuration
const handler = new OAuthHandler({
  providers: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/auth/callback',
    },
    gmail: {
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/auth/callback',
    },
  },
});

// Export as Nuxt event handler
export default defineEventHandler(async (event) => {
  // Convert H3 event to Web Request
  const request = new Request(
    `http://${event.node.req.headers.host}${event.node.req.url}`,
    {
      method: event.node.req.method,
      headers: event.node.req.headers as any,
      body: event.node.req.method !== 'GET' ? await readBody(event) : undefined,
    }
  );
  
  return handler.handler(request);
});

