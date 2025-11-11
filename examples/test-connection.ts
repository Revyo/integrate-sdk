/**
 * Simple Connection Test
 * 
 * Tests the basic connection to your production MCP server
 * without requiring OAuth credentials.
 */

import { createMCPClient, createSimplePlugin } from "../src/index.js";

async function testConnection() {
  console.log("🔍 Testing connection to MCP server...");
  console.log("Server URL: https://mcp.integrate.dev/api/v1/mcp\n");

  // Create a minimal client without OAuth plugins
  const client = createMCPClient({
    plugins: [
      // Simple plugin that doesn't require OAuth
      createSimplePlugin({
        id: "test",
        tools: [], // We'll get actual tools from the server
      }),
    ],
    timeout: 10000, // 10 second timeout
  });

  try {
    // Step 1: Connect to the server
    console.log("1️⃣  Connecting to server...");
    await client.connect();
    console.log("✅ Connected successfully!\n");

    // Step 2: List all available tools from the server
    console.log("2️⃣  Fetching available tools...");
    const tools = client.getAvailableTools();
    console.log(`✅ Server has ${tools.length} tools available\n`);

    // Step 3: Display the tools
    if (tools.length > 0) {
      console.log("📋 Available Tools:");
      console.log("─".repeat(80));
      
      // Group tools by prefix (provider)
      const toolsByProvider = new Map<string, typeof tools>();
      tools.forEach((tool) => {
        const prefix = tool.name.split("_")[0] || "other";
        if (!toolsByProvider.has(prefix)) {
          toolsByProvider.set(prefix, []);
        }
        toolsByProvider.get(prefix)!.push(tool);
      });

      // Display grouped tools
      for (const [provider, providerTools] of toolsByProvider) {
        console.log(`\n🔧 ${provider.toUpperCase()} (${providerTools.length} tools):`);
        providerTools.forEach((tool) => {
          const description = tool.description || "No description";
          console.log(`   • ${tool.name}`);
          console.log(`     ${description.substring(0, 70)}${description.length > 70 ? "..." : ""}`);
        });
      }
      
      console.log("\n" + "─".repeat(80));
    } else {
      console.log("⚠️  No tools available from the server");
    }

    // Step 4: Test getting a specific tool's schema
    if (tools.length > 0) {
      const firstTool = tools[0];
      console.log(`\n3️⃣  Getting schema for '${firstTool.name}'...`);
      console.log("Schema:", JSON.stringify(firstTool.inputSchema, null, 2).substring(0, 300) + "...");
    }

    console.log("\n✅ All tests passed!");
    console.log("\n💡 Next steps:");
    console.log("   1. Set up OAuth credentials for the providers you want to use");
    console.log("   2. Run 'bun examples/basic-usage.ts' to test tool calls");
    console.log("   3. Check the README.md for plugin configuration examples");

  } catch (error) {
    console.error("\n❌ Connection test failed!");
    console.error("\nError details:");
    if (error instanceof Error) {
      console.error(`  Message: ${error.message}`);
      console.error(`  Stack: ${error.stack?.split("\n").slice(0, 3).join("\n")}`);
    } else {
      console.error(error);
    }
    
    console.log("\n🔍 Troubleshooting:");
    console.log("   1. Check if the server is running at https://mcp.integrate.dev/api/v1/mcp");
    console.log("   2. Verify the endpoint path is /api/v1/mcp");
    console.log("   3. Check if there are any firewall or network issues");
    console.log("   4. Ensure the server is accessible from your location");
    
    process.exit(1);
  } finally {
    // Always disconnect
    await client.disconnect();
    console.log("\n👋 Disconnected from server");
  }
}

// Run the test
if (import.meta.main) {
  testConnection().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}


