/**
 * Basic Usage Example
 *
 * This example demonstrates how to create an MCP client with integrations
 * and interact with the server.
 */

import {
  createMCPClient,
  githubIntegration,
  gmailIntegration,
} from "../src/index.js";

async function main() {
  // Create a client with multiple integrations
  // Integrations automatically read GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, etc. from environment
  const client = createMCPClient({
    integrations: [
      // GitHub integration with OAuth configuration
      githubIntegration({
        scopes: ["repo", "user"],
        // clientId and clientSecret automatically read from GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
      }),

      // Gmail integration with OAuth configuration
      gmailIntegration({
        // clientId and clientSecret automatically read from GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET
      }),
    ],

    // Optional configuration
    timeout: 30000,
    headers: {
      "X-Custom-Header": "value",
    },
    clientInfo: {
      name: "my-integration",
      version: "1.0.0",
    },
  });

  try {
    // Connect to the server
    console.log("Connecting to MCP server...");
    await client.connect();
    console.log("Connected!");

    // List available tools
    const enabledTools = client.getEnabledTools();
    console.log("\nEnabled tools:");
    enabledTools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description || "No description"}`);
    });

    // Get OAuth configurations
    const oauthConfigs = client.getAllOAuthConfigs();
    console.log("\nOAuth configurations:");
    for (const [integrationId, config] of oauthConfigs) {
      console.log(`  - ${integrationId}: ${config.provider} (${config.scopes.join(", ")})`);
    }

    // Example: Get a GitHub repository
    console.log("\n--- GitHub Example ---");
    try {
      const repo = await client.github.getRepo({
        owner: "facebook",
        repo: "react",
      });
      console.log("Repository:", JSON.stringify(repo, null, 2).substring(0, 500));
    } catch (error) {
      console.error("Failed to get repo:", error);
    }

    // Example: List your own GitHub repositories
    console.log("\n--- List Own Repos ---");
    try {
      const repos = await client.github.listOwnRepos({});
      console.log("Your repositories:", JSON.stringify(repos, null, 2).substring(0, 500));
    } catch (error) {
      console.error("Failed to list repos:", error);
    }

    // Example: Send an email with Gmail
    console.log("\n--- Gmail Example ---");
    try {
      const result = await client.gmail.sendMessage({
        to: "example@example.com",
        subject: "Test Email",
        body: "This is a test email sent via MCP",
      });
      console.log("Email sent:", JSON.stringify(result, null, 2).substring(0, 500));
    } catch (error) {
      console.error("Failed to send email:", error);
    }

    // Listen for server notifications
    const unsubscribe = client.onMessage((message) => {
      console.log("\nReceived message from server:", message);
    });

    // Example: Get a specific tool's schema
    const getRepoTool = client.getTool("github_get_repo");
    if (getRepoTool) {
      console.log("\n--- Tool Schema ---");
      console.log("Tool:", getRepoTool.name);
      console.log("Description:", getRepoTool.description);
      console.log("Input Schema:", JSON.stringify(getRepoTool.inputSchema, null, 2).substring(0, 300));
    }

    // Clean up
    unsubscribe();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // Always disconnect when done
    console.log("\nDisconnecting...");
    await client.disconnect();
    console.log("Disconnected!");
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}

