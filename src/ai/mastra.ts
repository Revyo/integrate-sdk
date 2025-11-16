/**
 * Mastra AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Mastra AI SDK format
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
 * Mastra tool definition
 * Compatible with @mastra/core
 */
export interface MastraTool {
  id: string;
  description: string;
  inputSchema?: z.ZodType<any>;
  outputSchema?: z.ZodType<any>;
  execute: (params: { context: Record<string, unknown> }) => Promise<any>;
}

/**
 * Options for converting MCP tools to Mastra format
 */
export interface MastraToolsOptions extends AIToolsOptions { }

/**
 * Convert a single MCP tool to Mastra AI SDK format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Mastra compatible tool definition
 * 
 * @example
 * ```typescript
 * const mastraTool = convertMCPToolToMastra(mcpTool, client);
 * ```
 */
export function convertMCPToolToMastra(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: MastraToolsOptions
): MastraTool {
  return {
    id: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    inputSchema: jsonSchemaToZod(mcpTool.inputSchema),
    execute: async ({ context }: { context: Record<string, unknown> }) => {
      const result = await executeToolWithToken(client, mcpTool.name, context, options);
      return result;
    },
  };
}

/**
 * Convert all enabled MCP tools to Mastra AI SDK format
 * Returns a dictionary keyed by tool ID
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Dictionary of Mastra compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToMastra(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToMastra(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToMastra(
  client: MCPClient<any>,
  options?: MastraToolsOptions
): Record<string, MastraTool> {
  const mcpTools = client.getEnabledTools();
  const tools: Record<string, MastraTool> = {};

  for (const mcpTool of mcpTools) {
    tools[mcpTool.name] = convertMCPToolToMastra(mcpTool, client, options);
  }

  return tools;
}

/**
 * Get tools in a format compatible with Mastra AI SDK
 * 
 * Automatically connects the client if not already connected.
 * Returns tool configurations that can be used with Mastra's tool system.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Dictionary of tools ready to use with Mastra AI SDK
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { getMastraTools } from 'integrate-sdk/ai/mastra';
 * import { createTool, Agent } from '@mastra/core';
 * 
 * const client = createMCPClient({
 *   integrations: [githubIntegration({ clientId: '...' })],
 * });
 * 
 * const toolConfigs = await getMastraTools(client);
 * 
 * // Create Mastra tools
 * const tools = Object.fromEntries(
 *   Object.entries(toolConfigs).map(([id, config]) => [
 *     id,
 *     createTool(config)
 *   ])
 * );
 * 
 * const agent = new Agent({
 *   tools,
 *   model: { provider: 'openai', name: 'gpt-4' }
 * });
 * 
 * const result = await agent.generate('Create a GitHub issue');
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * import { getMastraTools } from 'integrate-sdk/ai/mastra';
 * 
 * const { client: serverClient } = createMCPServer({
 *   integrations: [githubIntegration({ 
 *     clientId: '...', 
 *     clientSecret: '...' 
 *   })],
 * });
 * 
 * // In your API route
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   const toolConfigs = await getMastraTools(serverClient, { providerTokens });
 *   
 *   // Create Mastra tools
 *   const tools = Object.fromEntries(
 *     Object.entries(toolConfigs).map(([id, config]) => [
 *       id,
 *       createTool(config)
 *     ])
 *   );
 *   
 *   const agent = new Agent({
 *     tools,
 *     model: { provider: 'openai', name: 'gpt-4' }
 *   });
 *   
 *   const result = await agent.generate('Create a GitHub issue');
 *   return Response.json(result);
 * }
 * ```
 */
export async function getMastraTools(
  client: MCPClient<any>,
  options?: MastraToolsOptions
): Promise<Record<string, MastraTool>> {
  await ensureClientConnected(client);
  return convertMCPToolsToMastra(client, options);
}

