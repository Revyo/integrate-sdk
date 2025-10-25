/**
 * Test Server Behavior
 * Understand how the server actually handles streaming
 */

async function testServerBehavior() {
  console.log("=== Testing MCP Server Behavior ===\n");

  // Test 1: Does server support streaming?
  console.log("Test 1: Checking if server keeps connection open...");
  
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  
  try {
    const encoder = new TextEncoder();
    
    // Try to establish streaming connection
    const fetchPromise = fetch("http://localhost:8080/api/v1/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: readable,
      duplex: "half" as any,
    });

    // Send initialize message
    const initMessage = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    
    await writer.write(encoder.encode(initMessage + "\n"));
    console.log("  ✓ Sent initialize request");

    // Wait for response with timeout
    const response = await Promise.race([
      fetchPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Fetch timeout")), 3000)
      ),
    ]) as Response;

    console.log("  ✓ Got response:", response.status);
    console.log("  Headers:", Object.fromEntries(response.headers.entries()));

    // Try to read response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const { value, done } = await reader.read();
      if (value) {
        const text = decoder.decode(value);
        console.log("  Response data:", text.substring(0, 200));
      }
      console.log("  Stream done:", done);
    }

    await writer.close();
  } catch (error) {
    console.log("  ✗ Error:", error.message);
  }

  console.log();

  // Test 2: Simple request/response
  console.log("Test 2: Testing simple request/response pattern...");
  
  try {
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

    console.log("  ✓ Status:", response.status);
    const data = await response.json();
    console.log("  ✓ Response:", JSON.stringify(data, null, 2).substring(0, 300));
  } catch (error) {
    console.log("  ✗ Error:", error.message);
  }

  console.log();

  // Test 3: Check for SSE support
  console.log("Test 3: Checking for Server-Sent Events...");
  
  try {
    const response = await fetch("http://localhost:8080/api/v1/mcp", {
      headers: {
        "Accept": "text/event-stream",
      },
    });

    console.log("  Status:", response.status);
    console.log("  Content-Type:", response.headers.get("content-type"));
  } catch (error) {
    console.log("  ✗ Error:", error.message);
  }
}

await testServerBehavior();

