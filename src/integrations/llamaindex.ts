/**
 * LlamaIndex Integration
 * 
 * Helper functions to convert MCP tools to LlamaIndex tool format
 */

import { z } from "zod";
import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { 
  jsonSchemaToZod, 
  executeToolWithToken, 
  ensureClientConnected, 
  type AIToolsOptions 
} from "./utils.js";

/**
 * LlamaIndex tool definition
 * Compatible with llamaindex package
 */
export interface LlamaIndexTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Options for converting MCP tools to LlamaIndex format
 */
export interface LlamaIndexToolsOptions extends AIToolsOptions {}

/**
 * Convert a single MCP tool to LlamaIndex format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns LlamaIndex compatible tool definition
 * 
 * @example
 * ```typescript
 * const llamaIndexTool = convertMCPToolToLlamaIndex(mcpTool, client);
 * ```
 */
export function convertMCPToolToLlamaIndex(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: LlamaIndexToolsOptions
): LlamaIndexTool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters: jsonSchemaToZod(mcpTool.inputSchema),
    execute: async (input: Record<string, unknown>) => {
      const result = await executeToolWithToken(client, mcpTool.name, input, options);
      return JSON.stringify(result);
    },
  };
}

/**
 * Convert all enabled MCP tools to LlamaIndex format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of LlamaIndex compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToLlamaIndex(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToLlamaIndex(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToLlamaIndex(
  client: MCPClient<any>,
  options?: LlamaIndexToolsOptions
): LlamaIndexTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToLlamaIndex(mcpTool, client, options));
}

/**
 * Get tools in a format compatible with LlamaIndex
 * 
 * Automatically connects the client if not already connected.
 * Returns tool configurations that can be used with LlamaIndex's tool system.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with LlamaIndex
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getLlamaIndexTools } from 'integrate-sdk/integrations/llamaindex';
 * import { OpenAIAgent, tool } from 'llamaindex';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * const toolConfigs = await getLlamaIndexTools(client);
 * 
 * // Create LlamaIndex tools
 * const tools = toolConfigs.map(config => 
 *   tool(config)
 * );
 * 
 * const agent = new OpenAIAgent({ tools });
 * const response = await agent.chat({
 *   message: "Create a GitHub issue"
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getLlamaIndexTools } from 'integrate-sdk/integrations/llamaindex';
 * 
 * const { client: serverClient } = createMCPServer({
 *   plugins: [githubPlugin({ 
 *     clientId: '...', 
 *     clientSecret: '...' 
 *   })],
 * });
 * 
 * // In your API route
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   const toolConfigs = await getLlamaIndexTools(serverClient, { providerTokens });
 *   
 *   // Create LlamaIndex tools
 *   const tools = toolConfigs.map(config => 
 *     tool(config)
 *   );
 *   
 *   const agent = new OpenAIAgent({ tools });
 *   const response = await agent.chat({
 *     message: "Create a GitHub issue"
 *   });
 *   
 *   return Response.json(response);
 * }
 * ```
 */
export async function getLlamaIndexTools(
  client: MCPClient<any>,
  options?: LlamaIndexToolsOptions
): Promise<LlamaIndexTool[]> {
  await ensureClientConnected(client);
  return convertMCPToolsToLlamaIndex(client, options);
}

