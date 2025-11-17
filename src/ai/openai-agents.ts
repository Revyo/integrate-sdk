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
  getProviderTokens,
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
export interface OpenAIAgentsToolsOptions extends AIToolsOptions { }

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
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with @openai/agents
 * 
 * @example
 * ```typescript
 * // Auto-extraction (recommended)
 * import { serverClient } from '@/lib/integrate-server';
 * import { getOpenAIAgentsTools } from 'integrate-sdk';
 * import { Agent } from '@openai/agents';
 * 
 * export async function POST(req: Request) {
 *   const tools = await getOpenAIAgentsTools(serverClient); // Tokens auto-extracted
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
 * 
 * @example
 * ```typescript
 * // Manual override
 * const tools = await getOpenAIAgentsTools(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export async function getOpenAIAgentsTools(
  client: MCPClient<any>,
  options?: OpenAIAgentsToolsOptions
): Promise<OpenAIAgentsTool[]> {
  await ensureClientConnected(client);

  // Auto-extract tokens if not provided
  let providerTokens = options?.providerTokens;
  if (!providerTokens) {
    try {
      providerTokens = await getProviderTokens();
    } catch {
      // Token extraction failed - that's okay
    }
  }

  const finalOptions = providerTokens ? { ...options, providerTokens } : options;
  return convertMCPToolsToOpenAIAgents(client, finalOptions);
}

