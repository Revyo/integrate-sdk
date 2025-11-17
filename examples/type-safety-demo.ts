/**
 * Type Safety Demo
 * 
 * This file demonstrates how TypeScript autocomplete only shows
 * integration namespaces that are actually configured.
 */

import { createMCPClient, githubIntegration, gmailIntegration, client as defaultClient } from "../index.js";

// Example 1: Client with only GitHub - autocomplete should ONLY show .github and .server
const githubOnlyClient = createMCPClient({
  integrations: [
    githubIntegration({
      scopes: ['repo', 'user'],
    }),
  ],
});

async function testGitHubOnly() {
  // ✅ These work - autocomplete shows them
  await githubOnlyClient.github.listOwnRepos({});
  await githubOnlyClient.server.listToolsByIntegration({ integration: 'github' });
  
  // ❌ This would be a TypeScript error - .gmail doesn't exist on this client
  // @ts-expect-error - gmail is not configured
  await githubOnlyClient.gmail.listMessages({});
  
  console.log('GitHub-only client type safety verified!');
}

// Example 2: Client with only Gmail - autocomplete should ONLY show .gmail and .server
const gmailOnlyClient = createMCPClient({
  integrations: [
    gmailIntegration({
      scopes: ['gmail.readonly'],
    }),
  ],
});

async function testGmailOnly() {
  // ✅ These work - autocomplete shows them
  await gmailOnlyClient.gmail.listMessages({});
  await gmailOnlyClient.server.listToolsByIntegration({ integration: 'gmail' });
  
  // ❌ This would be a TypeScript error - .github doesn't exist on this client
  // @ts-expect-error - github is not configured
  await gmailOnlyClient.github.listOwnRepos({});
  
  console.log('Gmail-only client type safety verified!');
}

// Example 3: Client with both integrations - autocomplete shows both
const bothIntegrationsClient = createMCPClient({
  integrations: [
    githubIntegration({
      scopes: ['repo', 'user'],
    }),
    gmailIntegration({
      scopes: ['gmail.readonly'],
    }),
  ],
});

async function testBothIntegrations() {
  // ✅ All of these work - autocomplete shows all configured integrations
  await bothIntegrationsClient.github.listOwnRepos({});
  await bothIntegrationsClient.gmail.listMessages({});
  await bothIntegrationsClient.server.listToolsByIntegration({ integration: 'github' });
  
  console.log('Both integrations client type safety verified!');
}

// Example 4: Default client - has all integrations pre-configured
async function testDefaultClient() {
  // ✅ Default client comes with github, gmail, and server
  await defaultClient.github.listOwnRepos({});
  await defaultClient.gmail.listMessages({});
  await defaultClient.server.listToolsByIntegration({ integration: 'github' });
  
  console.log('Default client has all integrations!');
}

/**
 * SUMMARY:
 * 
 * TypeScript autocomplete and type checking now correctly:
 * 
 * 1. Only shows integration namespaces that are configured
 * 2. Gives TypeScript errors when accessing unconfigured integrations
 * 3. Always shows .server namespace (available on all clients)
 * 4. Works with the default client (all integrations)
 * 5. Works with custom clients (only configured integrations)
 * 
 * This means:
 * - Better developer experience with accurate autocomplete
 * - Compile-time safety - catch configuration errors early
 * - No confusion about which integrations are available
 */

async function main() {
  console.log("=== Type Safety Demo ===\n");
  
  try {
    await testGitHubOnly();
    await testGmailOnly();
    await testBothIntegrations();
    await testDefaultClient();
    
    console.log("\n✓ All type safety checks passed!");
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the demo
if (import.meta.main) {
  main().catch(console.error);
}

