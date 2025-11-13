/**
 * Astro OAuth Route Example
 * File: pages/api/auth/[...all].ts
 * 
 * This file should be placed in your Astro project's pages/api/auth/ directory.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { toAstroHandler } from 'integrate-sdk/adapters/astro';
import type { APIRoute } from 'astro';

// Create the OAuth handler with your provider configuration
const handler = toAstroHandler({
  providers: {
    github: {
      clientId: import.meta.env.GITHUB_CLIENT_ID!,
      clientSecret: import.meta.env.GITHUB_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/auth/callback',
    },
    gmail: {
      clientId: import.meta.env.GMAIL_CLIENT_ID!,
      clientSecret: import.meta.env.GMAIL_CLIENT_SECRET!,
      redirectUri: 'http://localhost:3000/api/auth/callback',
    },
  },
});

// Export as ALL to handle all HTTP methods
export const ALL: APIRoute = handler;

