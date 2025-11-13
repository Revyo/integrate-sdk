/**
 * Hono OAuth Example
 * Demonstrates how to set up OAuth routes with Hono
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OAuthHandler } from 'integrate-sdk';

const app = new Hono();

// Enable CORS
app.use('/api/auth/*', cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));

// Create OAuth handler
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

// Register OAuth routes with catch-all
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return handler.handler(c.req.raw);
});

// Example protected route
app.get('/api/user', (c) => {
  return c.json({ message: 'Protected route' });
});

export default app;

