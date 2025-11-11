/**
 * Simplified Usage Example
 * 
 * This example demonstrates the new simplified API where:
 * - No need to manually call connect()
 * - No need to manually call disconnect()
 * - Singleton pattern automatically reuses connections
 * - Auto-cleanup on process exit
 */

import { createMCPClient, githubPlugin, gmailPlugin } from "../src/index.js";

async function main() {
  console.log("=== Simplified Usage Example ===\n");

  // Just create the client - no need to call connect()!
  const client = createMCPClient({
    plugins: [
      githubPlugin({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
      gmailPlugin({
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
      }),
    ],
  });

  // Just use it! Automatically connects on first call
  console.log("Calling GitHub API...");
  try {
    const repos = await client.github.listOwnRepos({});
    console.log("✓ Successfully fetched repos");
  } catch (error) {
    console.error("✗ Error:", error.message);
  }

  // Create another "client" with same config - gets the cached instance
  console.log("\nCreating another client with same config...");
  const client2 = createMCPClient({
    plugins: [
      githubPlugin({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
      gmailPlugin({
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
      }),
    ],
  });

  console.log("Same instance?", client === client2); // true!

  // Use either client - they're the same
  console.log("\nUsing the second client reference...");
  try {
    const repo = await client2.github.getRepo({
      owner: "facebook",
      repo: "react",
    });
    console.log("✓ Successfully fetched repo");
  } catch (error) {
    console.error("✗ Error:", error.message);
  }

  // No need to call disconnect()!
  // It will automatically cleanup on process exit
  console.log("\n✓ Done! No manual cleanup needed.");
  console.log("The client will automatically disconnect on exit.");
}

// Example: Different connection modes
async function connectionModesExample() {
  console.log("\n\n=== Connection Modes Example ===\n");

  // Lazy (default): connects on first method call
  console.log("1. Lazy mode (default):");
  const lazyClient = createMCPClient({
    plugins: [githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })],
    connectionMode: 'lazy', // This is the default
  });
  console.log("   Client created, not connected yet");
  await lazyClient.github.listOwnRepos({});
  console.log("   ✓ Connected automatically on first call");

  // Eager: connects immediately (but doesn't block)
  console.log("\n2. Eager mode:");
  const eagerClient = createMCPClient({
    plugins: [githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })],
    connectionMode: 'eager',
    singleton: false, // Create fresh instance
  });
  console.log("   Client created, connecting in background...");
  // Give it a moment to connect
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log("   ✓ Connected eagerly");

  // Manual: requires explicit connect() call (original behavior)
  console.log("\n3. Manual mode:");
  const manualClient = createMCPClient({
    plugins: [githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })],
    connectionMode: 'manual',
    singleton: false,
  });
  console.log("   Client created, must connect manually");
  await manualClient.connect();
  console.log("   ✓ Connected manually");
  await manualClient.github.listOwnRepos({});
  console.log("   ✓ Used successfully");
  await manualClient.disconnect();
  console.log("   ✓ Disconnected manually");
}

// Example: Disable singleton for testing
async function testingExample() {
  console.log("\n\n=== Testing Example ===\n");

  // For testing, you might want fresh instances
  const testClient1 = createMCPClient({
    plugins: [githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })],
    singleton: false, // Each call creates a new instance
    autoCleanup: true, // Still auto-cleanup on exit
  });

  const testClient2 = createMCPClient({
    plugins: [githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })],
    singleton: false,
  });

  console.log("Different instances?", testClient1 !== testClient2); // true!
  console.log("✓ Each call created a fresh instance for testing");

  // Both will auto-cleanup on exit
  // Or you can manually disconnect if needed:
  await testClient1.disconnect();
  await testClient2.disconnect();
  console.log("✓ Manually disconnected both");
}

// Run all examples
if (import.meta.main) {
  try {
    await main();
    await connectionModesExample();
    await testingExample();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

