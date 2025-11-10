/**
 * Debug Connection Example
 * Tests the connection step-by-step to identify issues
 */

import { createMCPClient, createSimplePlugin } from "../src/index.js";

async function debugConnection() {
  console.log("=== MCP Client Debug ===\n");

  // Create a minimal client with just one simple plugin
  const client = createMCPClient({
    customerId: 'cust_example123',
    plugins: [
      createSimplePlugin({
        id: "test",
        tools: ["test/echo"], // Adjust to match your server's tools
      }),
    ],
    timeout: 10000, // 10 second timeout for easier debugging
  });

  console.log("✓ Client created");
  console.log("  Server URL:", "https://mcp.integrate.dev/api/v1/mcp");
  console.log("  Timeout:", "10000ms");
  console.log();

  try {
    console.log("Attempting to connect...");
    console.log("  Step 1: Creating HTTP streaming connection");
    
    // Add a simple timeout to see if it's hanging
    const connectPromise = client.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Manual timeout")), 5000)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    console.log("✓ Connected successfully!");
    console.log();

    console.log("=== Connection Details ===");
    console.log("  Is Connected:", client.isConnected());
    console.log("  Is Initialized:", client.isInitialized());
    console.log();

    console.log("=== Discovered Tools ===");
    const tools = client.getEnabledTools();
    console.log(`  Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`    - ${tool.name}`);
    });
    console.log();

    await client.disconnect();
    console.log("✓ Disconnected successfully");
  } catch (error) {
    console.error("\n✗ Connection failed:");
    console.error("  Error:", error.message);
    console.error();
    
    if (error.message.includes("timeout") || error.message.includes("Manual timeout")) {
      console.error("DIAGNOSIS: Connection is timing out");
      console.error("This usually means:");
      console.error("  1. Server is not responding to the HTTP streaming request");
      console.error("  2. Server is not sending back the initialize response");
      console.error("  3. HTTP duplex streaming is not working");
      console.error();
      console.error("Next steps:");
      console.error("  - Check server logs to see if it received the connection");
      console.error("  - Verify the server endpoint: POST /api/v1/mcp");
      console.error("  - Test with curl: curl -X POST http://localhost:8080/api/v1/mcp");
    } else if (error.message.includes("ECONNREFUSED")) {
      console.error("DIAGNOSIS: Server is not running");
      console.error("  - Make sure your MCP server is started on port 8080");
    } else if (error.message.includes("ECONNRESET")) {
      console.error("DIAGNOSIS: Server closed the connection");
      console.error("  - Server might not support HTTP streaming");
      console.error("  - Check if server expects a different protocol");
    }

    process.exit(1);
  }
}

// Test basic connectivity first
async function testBasicConnectivity() {
  console.log("=== Testing Basic Connectivity ===\n");
  
  try {
    console.log("Testing HTTP POST to server...");
    const response = await fetch("http://localhost:8080/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    console.log("✓ Server responded");
    console.log("  Status:", response.status, response.statusText);
    console.log("  Headers:", Object.fromEntries(response.headers.entries()));
    console.log();

    if (response.ok) {
      const text = await response.text();
      console.log("  Response:", text.substring(0, 200));
      console.log();
    }
  } catch (error) {
    console.error("✗ Failed to reach server");
    console.error("  Error:", error.message);
    console.error();
    console.error("Make sure your MCP server is running on port 8080");
    process.exit(1);
  }
}

// Run tests
console.clear();
await testBasicConnectivity();
await debugConnection();

