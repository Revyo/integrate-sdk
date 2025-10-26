/**
 * Vercel AI SDK Integration Example
 * 
 * This example shows how to use the Integrate SDK with Vercel's AI SDK
 * to give AI models access to GitHub, Gmail, and other integrations.
 */

import {
  createMCPClient,
  githubPlugin,
  gmailPlugin,
  getVercelAITools,
} from "../src/index.js";

async function main() {
  // 1. Create and connect the MCP client
  const mcpClient = createMCPClient({
    plugins: [
      githubPlugin({
        clientId: process.env.GITHUB_CLIENT_ID || "your-client-id",
        clientSecret: process.env.GITHUB_CLIENT_SECRET || "your-client-secret",
        scopes: ["repo", "user"],
      }),
      gmailPlugin({
        clientId: process.env.GMAIL_CLIENT_ID || "your-client-id",
        clientSecret: process.env.GMAIL_CLIENT_SECRET || "your-client-secret",
      }),
    ],
  });

  await mcpClient.connect();
  console.log("✅ Connected to MCP server");

  // 2. Convert MCP tools to Vercel AI SDK format
  const tools = getVercelAITools(mcpClient);

  console.log(`\n📋 Available tools for AI: ${Object.keys(tools).join(", ")}\n`);

  // 3. Use with Vercel AI SDK
  // Uncomment this code when you have the 'ai' package installed:
  /*
  import { generateText } from 'ai';
  import { openai } from '@ai-sdk/openai';

  const result = await generateText({
    model: openai('gpt-5'),
    prompt: 'Create a GitHub issue titled "Bug: Login not working" in the repository owner/repo',
    tools,
    maxToolRoundtrips: 5,
  });

  console.log('AI Response:', result.text);
  console.log('Tool Calls:', result.toolCalls);
  */

  // Example: Manually call a tool (to demonstrate it works)
  console.log("🧪 Testing tool execution...");
  try {
    const githubRepoTool = tools["github_get_repo"];
    if (githubRepoTool) {
      console.log(`\nTool: github_get_repo`);
      console.log(`Description: ${githubRepoTool.description}`);
      console.log(`Parameters: ${JSON.stringify(githubRepoTool.parameters, null, 2)}`);

      // Execute the tool
      const result = await githubRepoTool.execute({
        owner: "facebook",
        repo: "react",
      });

      console.log("\n✅ Tool executed successfully!");
      console.log("Result preview:", JSON.stringify(result, null, 2).substring(0, 300) + "...");
    }
  } catch (error) {
    console.error("❌ Tool execution failed:", error);
  }

  // Cleanup
  await mcpClient.disconnect();
  console.log("\n👋 Disconnected from MCP server");
}

// Run the example
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

