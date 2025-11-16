/**
 * Gmail Integration Test
 * 
 * This example tests the Gmail integration without requiring OAuth credentials.
 * It will connect to the server and list available Gmail tools.
 */

import { createMCPClient, gmailIntegration } from "../src/index.js";

async function testGmailIntegration() {
  console.log("🧪 Testing Gmail Integration\n");

  // Create client with Gmail integration
  // Using placeholder credentials since we're just testing tool availability
  const client = createMCPClient({
    integrations: [
      gmailIntegration({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      }),
    ],
  });

  try {
    console.log("📡 Connecting to MCP server...");
    await client.connect();
    console.log("✅ Connected successfully!\n");

    // Get all available tools
    const allTools = client.getAvailableTools();
    console.log(`📋 Total tools available: ${allTools.length}`);

    // List Gmail tools by integration using server method
    console.log("\n🔍 Listing Gmail tools by integration...");
    try {
      const gmailToolsList = await client.server.listToolsByIntegration({
        integration: "gmail",
      });

      const toolNames = (gmailToolsList.structuredContent?.tools as string[]) || [];
      console.log(`\n📧 Gmail tools available: ${toolNames.length}\n`);

      if (toolNames.length > 0) {
        console.log("Available Gmail methods:");

        // Get tool descriptions from enabled tools
        const enabledTools = client.getEnabledTools();
        toolNames.forEach((toolName) => {
          const tool = enabledTools.find((t) => t.name === toolName);
          const methodName = toolName.replace("gmail_", "");
          const camelCase = methodName.replace(/_([a-z])/g, (g) =>
            g[1].toUpperCase()
          );
          console.log(`  • client.gmail.${camelCase}()`);
          console.log(`    ${tool?.description || "No description"}`);
        });
      }
    } catch (error: any) {
      console.log("❌ Could not list tools by integration:", error.message);
    }

    // Test the typed API (will fail without OAuth, but shows the interface)
    console.log("\n📝 Testing typed Gmail API...\n");

    console.log("Example usage (requires OAuth):");
    console.log(`
  // Send a message
  await client.gmail.sendMessage({
    to: "recipient@example.com",
    subject: "Test Email",
    body: "This is a test email from the Integrate SDK!",
  });

  // List messages
  await client.gmail.listMessages({
    maxResults: 10,
    q: "is:unread",
  });

  // Get a message
  await client.gmail.getMessage({
    id: "message-id-123",
  });

  // Search messages
  await client.gmail.searchMessages({
    query: "from:notifications@github.com",
    maxResults: 20,
  });
    `);

    // Try to call a method to see what error we get without OAuth
    console.log("🔐 Attempting to call sendMessage (will require OAuth)...");
    try {
      const result = await client.gmail.sendMessage({
        to: "test@example.com",
        subject: "Test",
        body: "Test body",
      });
      console.log("✅ Success:", result);
    } catch (error: any) {
      console.log("❌ Expected error (needs OAuth):", error.message);

      if (error.message.includes("401") || error.message.includes("authentication") || error.message.includes("Unauthorized")) {
        console.log("\n✅ Gmail integration is working! It's correctly requiring authentication.");
      } else if (error.message.includes("not available")) {
        console.log("\n⚠️ Gmail tools might not be available on the server yet.");
      }
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) {
      console.error("\nStack trace:", error.stack);
    }
  } finally {
    await client.disconnect();
    console.log("\n👋 Disconnected from server");
  }
}

// Run the test
if (import.meta.main) {
  testGmailIntegration().catch(console.error);
}

