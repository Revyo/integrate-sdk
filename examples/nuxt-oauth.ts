/**
 * Nuxt OAuth Example
 * File: server/api/integrate/oauth/[...all].ts
 * 
 * This file should be placed in your Nuxt project's server/api/ directory.
 * It creates a catch-all route that handles all OAuth actions.
 */

import { toNuxtHandler } from 'integrate-sdk/adapters/nuxt';

// Create the OAuth handler with your provider configuration
const handler = toNuxtHandler({
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

// Export as Nuxt event handler
export default defineEventHandler(handler);

