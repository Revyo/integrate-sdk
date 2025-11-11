/**
 * Re-authentication Handler Example
 *
 * This example demonstrates how to handle OAuth token expiration and
 * re-authentication automatically when tokens expire.
 */

import {
  createMCPClient,
  githubPlugin,
  gmailPlugin,
  type ReauthContext,
} from "../src/index.js";

/**
 * Example re-authentication handler
 * In a real application, this would trigger your OAuth flow UI
 */
async function handleReauth(context: ReauthContext): Promise<boolean> {
  console.log("\n🔐 Re-authentication Required");
  console.log(`   Provider: ${context.provider}`);
  console.log(`   Reason: ${context.error.message}`);
  if (context.toolName) {
    console.log(`   Tool: ${context.toolName}`);
  }

  // In a real application, you would:
  // 1. Show a UI notification to the user
  // 2. Trigger your OAuth flow (redirect to provider, open popup, etc.)
  // 3. Wait for the user to complete authentication
  // 4. Update tokens in your backend/database
  // 5. Return true if successful, false otherwise

  console.log("\n   ℹ️ In a production app, this would:");
  console.log("   1. Show a notification to the user");
  console.log("   2. Trigger OAuth flow (redirect/popup)");
  console.log("   3. Wait for user to re-authenticate");
  console.log("   4. Update stored tokens");
  console.log("   5. Return success/failure\n");

  // For this example, we'll simulate a successful re-auth
  // In reality, return true only after successful OAuth flow
  return true;
}

async function main() {
  console.log("--- Re-authentication Handler Example ---\n");

  // Create client with re-authentication handler
  const client = createMCPClient({
    plugins: [
      githubPlugin({
        clientId: process.env.GITHUB_CLIENT_ID || "your-github-client-id",
        clientSecret:
          process.env.GITHUB_CLIENT_SECRET || "your-github-client-secret",
        scopes: ["repo", "user"],
      }),
      gmailPlugin({
        clientId: process.env.GMAIL_CLIENT_ID || "your-gmail-client-id",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "your-gmail-client-secret",
      }),
    ],

    // Configure re-authentication handler
    onReauthRequired: handleReauth,

    // Optional: Set max retry attempts (default: 1)
    maxReauthRetries: 2,
  });

  console.log("✅ Client created with re-authentication handler\n");

  // Connect to the MCP server
  await client.connect();
  console.log("✅ Connected to MCP server\n");

  // Check authentication state
  console.log("📊 Authentication State:");
  console.log(`   GitHub: ${client.isProviderAuthenticated("github") ? "✅" : "❌"}`);
  console.log(`   Gmail: ${client.isProviderAuthenticated("gmail") ? "✅" : "❌"}\n`);

  // Example 1: Normal tool call (will succeed)
  try {
    console.log("🔧 Calling tool: github.getRepo");
    const result = await client.github.getRepo({
      owner: "facebook",
      repo: "react",
    });
    console.log("✅ Tool call succeeded\n");
  } catch (error) {
    console.error("❌ Tool call failed:", error);
  }

  // Example 2: Simulating token expiration
  // In reality, this would happen when the server returns a 401 error
  console.log("\n--- Simulating Token Expiration ---\n");
  console.log(
    "💡 When a tool call fails with 401/token expired, the SDK will:"
  );
  console.log("   1. Detect the authentication error");
  console.log("   2. Call your onReauthRequired handler");
  console.log("   3. Retry the tool call if re-auth succeeds");
  console.log("   4. Return error if re-auth fails or max retries exceeded\n");

  // Example 3: Manual re-authentication
  console.log("--- Manual Re-authentication ---\n");
  try {
    console.log("🔄 Manually triggering re-authentication for GitHub...");
    const success = await client.reauthenticate("github");
    if (success) {
      console.log("✅ Re-authentication successful\n");
    } else {
      console.log("❌ Re-authentication failed\n");
    }
  } catch (error) {
    console.error("❌ Re-authentication error:", error);
  }

  // Example 4: Checking auth state after operations
  console.log("\n--- Final Authentication State ---");
  const githubState = client.getAuthState("github");
  if (githubState) {
    console.log(`GitHub:`);
    console.log(`  Authenticated: ${githubState.authenticated ? "✅" : "❌"}`);
    if (githubState.lastError) {
      console.log(`  Last Error: ${githubState.lastError.message}`);
    }
  }

  const gmailState = client.getAuthState("gmail");
  if (gmailState) {
    console.log(`Gmail:`);
    console.log(`  Authenticated: ${gmailState.authenticated ? "✅" : "❌"}`);
    if (gmailState.lastError) {
      console.log(`  Last Error: ${gmailState.lastError.message}`);
    }
  }

  console.log("\n👋 Disconnecting from MCP server");
  await client.disconnect();
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}

