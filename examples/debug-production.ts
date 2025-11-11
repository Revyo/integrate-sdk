/**
 * Debug Production Connection
 * 
 * Verbose debugging to see exactly where the connection is failing
 */

async function debugConnection() {
  const serverUrl = "https://mcp.integrate.dev/api/v1/mcp";
  
  console.log("🔍 Debug Connection Test");
  console.log("=" .repeat(80));
  console.log(`Server URL: ${serverUrl}\n`);

  // Test 1: Can we reach the server at all?
  console.log("1️⃣  Testing basic HTTP connectivity...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(serverUrl, {
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
          capabilities: { tools: {} },
          clientInfo: { name: "debug-test", version: "1.0.0" },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get("content-type");
    console.log(`   Content-Type: ${contentType}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`   Response body: ${text.substring(0, 500)}`);
      
      try {
        const json = JSON.parse(text);
        console.log(`   ✅ Valid JSON response`);
        console.log(`   Response:`, JSON.stringify(json, null, 2));
      } catch (e) {
        console.log(`   ⚠️  Response is not JSON`);
      }
    } else {
      console.log(`   ❌ Server returned error status`);
      const text = await response.text();
      console.log(`   Error body: ${text}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("   ❌ Request timed out after 5 seconds");
    } else {
      console.log("   ❌ Request failed:", error);
    }
  }

  // Test 2: Try with GET (for SSE)
  console.log("\n2️⃣  Testing SSE endpoint (GET request)...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(serverUrl, {
      method: "GET",
      headers: {
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get("content-type")}`);
    
    if (response.ok && response.body) {
      console.log(`   ✅ SSE endpoint accessible`);
      // Try to read first chunk
      const reader = response.body.getReader();
      const { value } = await reader.read();
      if (value) {
        const text = new TextDecoder().decode(value);
        console.log(`   First chunk: ${text.substring(0, 200)}`);
      }
      reader.releaseLock();
      controller.abort(); // Stop reading
    } else {
      console.log(`   ⚠️  Not an SSE endpoint`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("   ℹ️  Timed out (expected for SSE)");
    } else {
      console.log("   ❌ Failed:", error);
    }
  }

  // Test 3: Check DNS resolution
  console.log("\n3️⃣  Testing DNS resolution...");
  try {
    const url = new URL(serverUrl);
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port}`);
    console.log(`   Path: ${url.pathname}`);
    console.log(`   Protocol: ${url.protocol}`);
  } catch (error) {
    console.log("   ❌ Invalid URL:", error);
  }

  // Test 4: Test with our SDK
  console.log("\n4️⃣  Testing with SDK client...");
  try {
    const { createMCPClient, createSimplePlugin } = await import("../src/index.js");
    
    const client = createMCPClient({
      plugins: [
        createSimplePlugin({
          id: "test",
          tools: [],
        }),
      ],
      timeout: 10000,
    });

    console.log("   Calling client.connect()...");
    const startTime = Date.now();
    
    await client.connect();
    
    const duration = Date.now() - startTime;
    console.log(`   ✅ Connected in ${duration}ms`);
    
    console.log("   Calling client.listTools()...");
    const tools = await client.listTools();
    console.log(`   ✅ Got ${tools.length} tools`);
    
    await client.disconnect();
    console.log("   ✅ Disconnected");
    
  } catch (error) {
    console.log("   ❌ SDK connection failed:", error);
    if (error instanceof Error) {
      console.log("   Stack:", error.stack);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("Debug test complete!");
}

if (import.meta.main) {
  debugConnection().catch(console.error);
}


