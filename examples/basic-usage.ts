/**
 * Basic Usage Example
 * 
 * This example demonstrates how to create an MCP client with plugins
 * and interact with the server.
 */

import {
  createMCPClient,
  githubPlugin,
  gmailPlugin,
  genericOAuthPlugin,
} from "../src/index.js";

async function main() {
  // Create a client with multiple plugins
  const client = createMCPClient({
    serverUrl: "http://localhost:8080/api/v1/mcp",
    plugins: [
      // GitHub plugin - using actual tool names from your server
      genericOAuthPlugin({
        id: "github",
        provider: "github",
        clientId: process.env.GITHUB_CLIENT_ID || "your-client-id",
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "your-client-secret",
        scopes: ["repo", "user"],
        tools: [
          "github_get_repo",
          "github_list_own_repos",
          "github_list_repos",
        ],
      }),

      // Notion plugin - using actual tool names from your server
      genericOAuthPlugin({
        id: "notion",
        provider: "notion",
        clientId: process.env.NOTION_CLIENT_ID || "your-client-id",
        clientSecret: process.env.NOTION_CLIENT_SECRET || "your-client-secret",
        scopes: [],
        tools: [
          "notion_get_page",
          "notion_search",
        ],
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
    for (const [pluginId, config] of oauthConfigs) {
      console.log(`  - ${pluginId}: ${config.provider} (${config.scopes.join(", ")})`);
    }

    // Example: Get a GitHub repository
    console.log("\n--- GitHub Example ---");
    try {
      const repo = await client.callTool("github_get_repo", {
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
      const repos = await client.callTool("github_list_own_repos", {});
      console.log("Your repositories:", JSON.stringify(repos, null, 2).substring(0, 500));
    } catch (error) {
      console.error("Failed to list repos:", error);
    }

    // Example: Search Notion
    console.log("\n--- Notion Example ---");
    try {
      const results = await client.callTool("notion_search", {
        query: "meeting",
      });
      console.log("Search results:", JSON.stringify(results, null, 2).substring(0, 500));
    } catch (error) {
      console.error("Failed to search Notion:", error);
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

