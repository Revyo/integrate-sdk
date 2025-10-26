/**
 * Vercel AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Vercel AI SDK format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";

/**
 * Tool definition for Vercel AI SDK
 */
export interface VercelAITool {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Convert MCP JSON Schema to Vercel AI SDK parameters format
 * 
 * Note: Vercel AI SDK typically uses Zod, but we return plain JSON Schema
 * which is compatible with the AI SDK's schema parameter
 */
function convertMCPSchemaToParameters(inputSchema: Record<string, unknown>): Record<string, unknown> {
  // MCP tools already use JSON Schema format
  // Vercel AI SDK accepts JSON Schema or Zod schemas
  return inputSchema;
}

/**
 * Convert a single MCP tool to Vercel AI SDK format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @returns Vercel AI SDK compatible tool definition
 */
export function convertMCPToolToVercelAI(
  mcpTool: MCPTool,
  client: MCPClient
): VercelAITool {
  return {
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters: convertMCPSchemaToParameters(mcpTool.inputSchema),
    execute: async (args: Record<string, unknown>) => {
      const result = await client.callTool(mcpTool.name, args);
      return result;
    },
  };
}

/**
 * Convert all enabled MCP tools to Vercel AI SDK format
 * 
 * @param client - The MCP client instance (must be connected)
 * @returns Object mapping tool names to Vercel AI SDK tool definitions
 * 
 * @example
 * ```typescript
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * import { generateText } from 'ai';
 * 
 * const mcpClient = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...', clientSecret: '...' })],
 * });
 * 
 * await mcpClient.connect();
 * 
 * const tools = convertMCPToolsToVercelAI(mcpClient);
 * 
 * const result = await generateText({
 *   model: openai('gpt-4'),
 *   prompt: 'Create a GitHub issue in my repo',
 *   tools,
 * });
 * ```
 */
export function convertMCPToolsToVercelAI(
  client: MCPClient
): Record<string, VercelAITool> {
  const mcpTools = client.getEnabledTools();
  const vercelTools: Record<string, VercelAITool> = {};

  for (const mcpTool of mcpTools) {
    vercelTools[mcpTool.name] = convertMCPToolToVercelAI(mcpTool, client);
  }

  return vercelTools;
}

/**
 * Get tools in a format compatible with Vercel AI SDK's tools parameter
 * 
 * This is an alternative that returns the tools in the exact format expected by ai.generateText()
 * 
 * @param client - The MCP client instance (must be connected)
 * @returns Tools object ready to pass to generateText({ tools: ... })
 */
export function getVercelAITools(client: MCPClient) {
  return convertMCPToolsToVercelAI(client);
}

