/**
 * Cross-Origin API Usage Example
 * 
 * This example demonstrates how to configure the SDK when your frontend
 * and backend API are hosted on different domains.
 * 
 * Common scenarios:
 * - Frontend on app.example.com, API on api.example.com
 * - Frontend on localhost:3000, API on localhost:4000 (development)
 * - Frontend on Vercel, API on AWS/Railway/Render
 */

import { createMCPClient, githubIntegration } from "../src/index.js";

/**
 * Scenario 1: Development with separate ports
 * Frontend: http://localhost:3000
 * API: http://localhost:4000
 */
function developmentSetup() {
  const client = createMCPClient({
    apiBaseUrl: 'http://localhost:4000', // API server URL
    apiRouteBase: '/api/integrate', // API route base path
    integrations: [
      githubIntegration({
        scopes: ['repo', 'user'],
      }),
    ],
  });

  // Will make requests to:
  // - http://localhost:4000/api/integrate/mcp (tool calls)
  // - http://localhost:4000/api/integrate/oauth/authorize (OAuth)
  // - http://localhost:4000/api/integrate/oauth/callback (OAuth)

  return client;
}

/**
 * Scenario 2: Production with separate domains
 * Frontend: https://app.example.com
 * API: https://api.example.com
 */
function productionSetup() {
  const client = createMCPClient({
    apiBaseUrl: 'https://api.example.com', // API server URL
    apiRouteBase: '/api/integrate', // API route base path
    integrations: [
      githubIntegration({
        scopes: ['repo', 'user'],
      }),
    ],
  });

  // Will make requests to:
  // - https://api.example.com/api/integrate/mcp (tool calls)
  // - https://api.example.com/api/integrate/oauth/authorize (OAuth)
  // - https://api.example.com/api/integrate/oauth/callback (OAuth)

  return client;
}

/**
 * Scenario 3: Custom API paths on different domain
 * Frontend: https://myapp.com
 * API: https://backend.myapp.com with custom routes at /v1/integrate
 */
function customPathSetup() {
  const client = createMCPClient({
    apiBaseUrl: 'https://backend.myapp.com', // API server URL
    apiRouteBase: '/v1/integrate', // Custom API route base
    oauthApiBase: '/v1/integrate/oauth', // Custom OAuth route base
    integrations: [
      githubIntegration({
        scopes: ['repo', 'user'],
      }),
    ],
  });

  // Will make requests to:
  // - https://backend.myapp.com/v1/integrate/mcp (tool calls)
  // - https://backend.myapp.com/v1/integrate/oauth/authorize (OAuth)
  // - https://backend.myapp.com/v1/integrate/oauth/callback (OAuth)

  return client;
}

/**
 * IMPORTANT: serverUrl vs apiBaseUrl
 * 
 * ⚠️ serverUrl - SERVER-SIDE ONLY (for createMCPServer)
 * Points to the actual MCP backend at https://mcp.integrate.dev
 * Only configure this in server-side code to point to a different MCP backend.
 * 
 * ✅ apiBaseUrl - CLIENT-SIDE (for createMCPClient)
 * Points to YOUR API server where your backend routes are hosted.
 * The client never calls the MCP server directly - it calls your API routes,
 * which then call the MCP server.
 * 
 * Flow:
 * Client (browser) → YOUR API (apiBaseUrl) → MCP Server (serverUrl)
 */

async function main() {
  console.log("=== Cross-Origin API Usage Example ===\n");

  // Use the appropriate setup for your environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  const client = isDevelopment ? developmentSetup() : productionSetup();

  try {
    // Use the client normally - it will make requests to the configured API
    console.log("Fetching repositories...");
    const repos = await client.github.listOwnRepos({ per_page: 5 });
    console.log("✓ Successfully fetched repos:", repos);
  } catch (error) {
    console.error("✗ Error:", error);
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}

