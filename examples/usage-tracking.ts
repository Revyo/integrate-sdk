import { createMCPClient, githubPlugin } from '../src/index.js';
import { createMCPServer } from '../src/server.js';

/**
 * CLIENT-SIDE: Usage Tracking Example
 * 
 * customerId is REQUIRED to track usage for billing with Polar.sh
 */

const client = createMCPClient({
  customerId: 'cust_abc123', // REQUIRED
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
});

// All tool calls automatically include X-Customer-ID header
async function exampleToolCall() {
  await client.connect();
  
  // This request includes: X-Customer-ID: cust_abc123
  const repo = await client.github.getRepo({
    owner: 'octocat',
    repo: 'Hello-World',
  });
  
  console.log('Repository fetched with usage tracked to customer:', 'cust_abc123');
}

/**
 * SERVER-SIDE: Usage Tracking Example
 */
const { client: serverClient } = createMCPServer({
  customerId: 'cust_server_internal', // REQUIRED
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});

console.log(`
Usage Tracking Configuration
============================

Customer ID: cust_abc123 (REQUIRED)

All requests to the MCP server include:
- X-Customer-ID header

The MCP server's userIDMiddleware extracts this header
and passes it to Polar.sh for usage-based billing.
`);

// Run the example
if (require.main === module) {
  exampleToolCall().catch(console.error);
}

