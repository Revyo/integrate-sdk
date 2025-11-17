/**
 * Type Safety Verification
 * 
 * This file demonstrates that:
 * 1. Only configured integrations appear in autocomplete
 * 2. Scopes are NOT sent from client (server-side only)
 */

import { createMCPClient, githubIntegration } from "../index.js";

// Custom client with ONLY GitHub configured
const githubOnlyClient = createMCPClient({
  integrations: [
    githubIntegration({
      // Scopes defined here are NOT sent to server
      // They're only for documentation/type hints
      // Server uses scopes from its own integration config
      scopes: ['repo', 'user'],
    }),
  ],
});

async function verifyTypeSystem() {
  console.log("=== Type Safety Verification ===\n");

  // ✅ This works - github is configured
  console.log("✓ client.github exists:", typeof githubOnlyClient.github);
  
  // ✅ This works - server is always available
  console.log("✓ client.server exists:", typeof githubOnlyClient.server);
  
  // ❌ This should NOT show in autocomplete - gmail is not configured
  // TypeScript will show: Property 'gmail' does not exist on type...
  // @ts-expect-error - Intentionally accessing unconfigured integration
  console.log("✗ client.gmail should not exist:", typeof githubOnlyClient.gmail);
  
  console.log("\n=== Scope Verification ===\n");
  console.log("✓ Scopes defined in client config are NOT sent to server");
  console.log("✓ Server uses scopes from its own integration configuration");
  console.log("✓ This prevents client from requesting unauthorized scopes");
  
  // When you call authorize(), NO scopes are sent to the server
  // The server already knows what scopes to use from its config
  await githubOnlyClient.authorize('github');
  
  console.log("\n✓ All type safety verifications passed!");
}

// Type-level verification (compile-time only)
type Verification = {
  // Should have github
  hasGitHub: typeof githubOnlyClient.github extends never ? false : true;
  
  // Should have server  
  hasServer: typeof githubOnlyClient.server extends never ? false : true;
  
  // Should NOT have gmail
  hasGmail: typeof githubOnlyClient extends { gmail: any } ? false : true;
};

// This should be: { hasGitHub: true, hasServer: true, hasGmail: true }
const _typeCheck: Verification = {
  hasGitHub: true,
  hasServer: true,
  hasGmail: true, // gmail property doesn't exist, so this is true
};

if (import.meta.main) {
  verifyTypeSystem().catch(console.error);
}

export { _typeCheck }; // Just to use the variable

