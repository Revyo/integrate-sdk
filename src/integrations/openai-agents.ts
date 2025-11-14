/**
 * OpenAI Agents Integration
 * 
 * Helper functions to convert MCP tools to @openai/agents format
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
 * OpenAI Agents tool definition
 * Compatible with @openai/agents package
 */
export interface OpenAIAgentsTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any) => Promise<any>;
}

/**
 * Options for converting MCP tools to OpenAI Agents format
 */
export interface OpenAIAgentsToolsOptions extends AIToolsOptions {}

/**
 * Convert a single MCP tool to OpenAI Agents format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns OpenAI Agents compatible tool definition
 * 
 * @example
 * ```typescript
 * const agentTool = convertMCPToolToOpenAIAgents(mcpTool, client);
 * ```
 */
export function convertMCPToolToOpenAIAgents(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: OpenAIAgentsToolsOptions
): OpenAIAgentsTool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters: jsonSchemaToZod(mcpTool.inputSchema),
    execute: async (args: Record<string, unknown>) => {
      return await executeToolWithToken(client, mcpTool.name, args, options);
    },
  };
}

/**
 * Convert all enabled MCP tools to OpenAI Agents format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of OpenAI Agents compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToOpenAIAgents(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToOpenAIAgents(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToOpenAIAgents(
  client: MCPClient<any>,
  options?: OpenAIAgentsToolsOptions
): OpenAIAgentsTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToOpenAIAgents(mcpTool, client, options));
}

/**
 * Get tools in a format compatible with @openai/agents
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with @openai/agents
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getOpenAIAgentsTools } from 'integrate-sdk/integrations/openai-agents';
 * import { Agent } from '@openai/agents';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * const tools = await getOpenAIAgentsTools(client);
 * 
 * const agent = new Agent({
 *   model: 'gpt-4o',
 *   tools,
 * });
 * 
 * const result = await agent.run('Create a GitHub issue');
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getOpenAIAgentsTools } from 'integrate-sdk/integrations/openai-agents';
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
 *   const tools = await getOpenAIAgentsTools(serverClient, { providerTokens });
 *   
 *   const agent = new Agent({
 *     model: 'gpt-4o',
 *     tools,
 *   });
 *   
 *   const result = await agent.run('Create a GitHub issue');
 *   return Response.json({ result });
 * }
 * ```
 */
export async function getOpenAIAgentsTools(
  client: MCPClient<any>,
  options?: OpenAIAgentsToolsOptions
): Promise<OpenAIAgentsTool[]> {
  await ensureClientConnected(client);
  return convertMCPToolsToOpenAIAgents(client, options);
}

