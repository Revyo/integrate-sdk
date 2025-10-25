/**
 * Custom Plugin Example
 * 
 * This example demonstrates how to create a custom plugin
 */

import { createMCPClient, createSimplePlugin } from "../src/index.js";
import type { MCPPlugin } from "../src/index.js";

// Example 1: Simple plugin without OAuth
const weatherPlugin = createSimplePlugin({
  id: "weather",
  tools: [
    "weather/getCurrentWeather",
    "weather/getForecast",
    "weather/getHistorical",
  ],
  
  async onInit(client) {
    console.log("Weather plugin initialized");
  },
  
  async onAfterConnect(client) {
    console.log("Weather plugin connected");
    // You could fetch initial data here, set up subscriptions, etc.
  },
});

// Example 2: Custom plugin with OAuth
interface NotionPluginConfig {
  integrationToken: string;
  workspaceId: string;
}

function notionPlugin(config: NotionPluginConfig): MCPPlugin<NotionPluginConfig> {
  return {
    id: "notion",
    tools: [
      "notion/createPage",
      "notion/updatePage",
      "notion/getPage",
      "notion/searchPages",
      "notion/createDatabase",
      "notion/queryDatabase",
    ],
    
    oauth: {
      provider: "notion",
      clientId: config.integrationToken,
      clientSecret: "", // Notion uses integration tokens
      scopes: ["read", "write"],
      config: {
        workspaceId: config.workspaceId,
      },
    },
    
    async onInit(client) {
      console.log("Notion plugin initialized for workspace:", config.workspaceId);
    },
    
    async onAfterConnect(client) {
      // Verify the integration token works
      try {
        const pages = await client.callTool("notion/searchPages", {
          query: "",
        });
        console.log("Notion plugin connected successfully");
      } catch (error) {
        console.error("Failed to connect to Notion:", error);
      }
    },
  };
}

// Example 3: Plugin with custom lifecycle hooks
interface DatabasePluginConfig {
  connectionString: string;
}

function databasePlugin(config: DatabasePluginConfig): MCPPlugin {
  let connectionPool: any = null;

  return {
    id: "database",
    tools: [
      "db/query",
      "db/execute",
      "db/transaction",
    ],
    
    async onInit(client) {
      console.log("Initializing database plugin...");
      // Set up connection pool
      connectionPool = {
        connection: config.connectionString,
        // ... initialize pool
      };
    },
    
    async onBeforeConnect(client) {
      console.log("Preparing database connection...");
      // Pre-connection setup
    },
    
    async onAfterConnect(client) {
      console.log("Database plugin connected");
      // Test connection
      try {
        await client.callTool("db/query", {
          sql: "SELECT 1",
        });
        console.log("Database connection verified");
      } catch (error) {
        console.error("Database connection failed:", error);
      }
    },
    
    async onDisconnect(client) {
      console.log("Closing database connections...");
      // Clean up connection pool
      if (connectionPool) {
        // ... close connections
        connectionPool = null;
      }
    },
  };
}

// Usage example
async function main() {
  const client = createMCPClient({
    serverUrl: "http://localhost:3000/api/v1/mcp",
    plugins: [
      weatherPlugin,
      notionPlugin({
        integrationToken: process.env.NOTION_TOKEN || "secret_token",
        workspaceId: process.env.NOTION_WORKSPACE_ID || "workspace-id",
      }),
      databasePlugin({
        connectionString: process.env.DATABASE_URL || "postgresql://localhost/db",
      }),
    ],
  });

  try {
    await client.connect();

    // Use the weather plugin
    const weather = await client.callTool("weather/getCurrentWeather", {
      location: "San Francisco, CA",
    });
    console.log("Current weather:", weather);

    // Use the Notion plugin
    const page = await client.callTool("notion/createPage", {
      title: "Meeting Notes",
      content: "Discussion points...",
    });
    console.log("Created Notion page:", page);

    // Use the database plugin
    const results = await client.callTool("db/query", {
      sql: "SELECT * FROM users LIMIT 10",
    });
    console.log("Query results:", results);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.disconnect();
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

