/**
 * Express OAuth Example
 * Demonstrates how to set up OAuth routes with Express
 */

import express from 'express';
import cors from 'cors';
import { OAuthHandler, toNodeHandler } from 'integrate-sdk';

const app = express();

// Enable CORS for frontend requests
app.use(cors({
  origin: 'http://localhost:3001',
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Create OAuth handler with provider configuration
const oauthHandler = new OAuthHandler({
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

// Convert Web API handler to Node.js handler
const handler = toNodeHandler(oauthHandler.handler.bind(oauthHandler));

// Register OAuth catch-all route
app.all('/api/integrate/*', handler);

// Example protected route
app.get('/api/user', (req, res) => {
  // In a real app, verify the authorization token here
  res.json({ message: 'Protected route' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
  console.log(`OAuth endpoints available at http://localhost:${PORT}/api/integrate/*`);
});

