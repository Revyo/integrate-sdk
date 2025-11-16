import { createMCPClient, githubIntegration } from '../src/index.js';
import { createMCPServer } from '../src/server.js';

/**
 * CLIENT-SIDE: Basic Usage Example
 * 
 * ⚠️ Client-side code should NEVER include an API key for security reasons.
 * API keys should only be used server-side via createMCPServer().
 */

const client = createMCPClient({
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
});

// Client-side tool calls (no API key - usage tracking happens server-side)
async function exampleToolCall() {
  await client.connect();

  const repo = await client.github.getRepo({
    owner: 'octocat',
    repo: 'Hello-World',
  });

  console.log('Repository fetched');
}

/**
 * SERVER-SIDE: Usage Tracking Example
 * 
 * ✅ API key should ONLY be configured server-side via createMCPServer()
 */
const { client: serverClient } = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY, // ✅ Secure - not exposed to client
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});

// Server-side tool calls automatically include X-API-KEY header for usage tracking
async function serverExampleToolCall() {
  await serverClient.connect();

  // This request includes: X-API-KEY: <your-api-key>
  const repo = await serverClient.github.getRepo({
    owner: 'octocat',
    repo: 'Hello-World',
  });

  console.log('Repository fetched with usage tracked to API key');
}

console.log(`
Usage Tracking Configuration
============================

✅ SERVER-SIDE (Secure):
  - API Key: ${process.env.INTEGRATE_API_KEY ? 'Set' : 'Not set'}
  - Sent as X-API-KEY header with all server requests
  - Used by Polar.sh for usage-based billing

❌ CLIENT-SIDE (Never do this):
  - Do NOT use NEXT_PUBLIC_ env vars for API key
  - Do NOT pass apiKey to createMCPClient()
  - Usage tracking should only happen server-side
`);

// Run the example
if (require.main === module) {
  exampleToolCall().catch(console.error);
}

