/**
 * Server Type Safety Demo
 * 
 * This demonstrates that createMCPServer also has dynamic types
 * that only show configured integrations.
 */

import { createMCPServer, githubIntegration, gmailIntegration } from "../src/server.js";

// Example 1: Server with only GitHub - should only show .github and .server
const githubOnlyServer = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'user'],
    }),
  ],
});

async function testGitHubOnlyServer() {
  const { client } = githubOnlyServer;
  
  // ✅ These work - autocomplete shows them
  await client.github.listOwnRepos({});
  await client.server.listToolsByIntegration({ integration: 'github' });
  
  // ❌ This would be a TypeScript error - .gmail doesn't exist
  // @ts-expect-error - gmail is not configured
  await client.gmail.listMessages({});
  
  console.log('✓ GitHub-only server has correct types!');
}

// Example 2: Server with only Gmail
const gmailOnlyServer = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  integrations: [
    gmailIntegration({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      scopes: ['gmail.readonly'],
    }),
  ],
});

async function testGmailOnlyServer() {
  const { client } = gmailOnlyServer;
  
  // ✅ These work - autocomplete shows them
  await client.gmail.listMessages({});
  await client.server.listToolsByIntegration({ integration: 'gmail' });
  
  // ❌ This would be a TypeScript error - .github doesn't exist
  // @ts-expect-error - github is not configured
  await client.github.listOwnRepos({});
  
  console.log('✓ Gmail-only server has correct types!');
}

// Example 3: Server with both integrations
const bothIntegrationsServer = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'user'],
    }),
    gmailIntegration({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      scopes: ['gmail.readonly'],
    }),
  ],
});

async function testBothIntegrationsServer() {
  const { client } = bothIntegrationsServer;
  
  // ✅ All work - both integrations configured
  await client.github.listOwnRepos({});
  await client.gmail.listMessages({});
  await client.server.listToolsByIntegration({ integration: 'github' });
  
  console.log('✓ Both integrations server has correct types!');
}

// Example 4: The server client also has handler, POST, and GET
async function testServerHandlers() {
  const { client, POST, GET } = bothIntegrationsServer;
  
  // ✅ Server client has all the handler methods
  const hasHandler = typeof client.handler === 'function';
  const hasPOST = typeof client.POST === 'function';
  const hasGET = typeof client.GET === 'function';
  
  console.log('✓ Server client has handler methods:', { hasHandler, hasPOST, hasGET });
  
  // You can also use the destructured handlers
  const hasPOSTHandler = typeof POST === 'function';
  const hasGETHandler = typeof GET === 'function';
  
  console.log('✓ Destructured handlers work:', { hasPOSTHandler, hasGETHandler });
}

/**
 * SUMMARY:
 * 
 * createMCPServer also has dynamic types that:
 * 
 * 1. Only show integration namespaces that are configured
 * 2. Give TypeScript errors for unconfigured integrations
 * 3. Always show .server namespace
 * 4. Include handler, POST, and GET methods for route handling
 * 
 * This means server-side code has the same type safety as client-side!
 */

async function main() {
  console.log("=== Server Type Safety Demo ===\n");
  
  try {
    await testGitHubOnlyServer();
    await testGmailOnlyServer();
    await testBothIntegrationsServer();
    await testServerHandlers();
    
    console.log("\n✓ All server type safety checks passed!");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the demo
if (import.meta.main) {
  main().catch(console.error);
}

