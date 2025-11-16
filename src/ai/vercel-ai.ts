/**
 * Vercel AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Vercel AI SDK v5 format
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
 * Tool definition compatible with Vercel AI SDK v5
 * This matches the CoreTool interface from 'ai' package v5
 */
export interface VercelAITool {
  description?: string;
  inputSchema: z.ZodType<any>; // Zod schema for tool parameters
  execute: (args: any, options?: any) => Promise<any>;
}

/**
 * Options for converting MCP tools to Vercel AI SDK format
 */
export interface VercelAIToolsOptions extends AIToolsOptions { }

/**
 * Convert a single MCP tool to Vercel AI SDK format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Vercel AI SDK compatible tool definition
 */
export function convertMCPToolToVercelAI(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
): VercelAITool {
  return {
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    inputSchema: jsonSchemaToZod(mcpTool.inputSchema), // Convert JSON Schema to Zod
    execute: async (args: Record<string, unknown>) => {
      return await executeToolWithToken(client, mcpTool.name, args, options);
    },
  };
}

/**
 * Convert all enabled MCP tools to Vercel AI SDK v5 format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Object mapping tool names to Vercel AI SDK v5 tool definitions (compatible with CoreTool from 'ai' package v5)
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * import { generateText } from 'ai';
 * 
 * const mcpClient = createMCPClient({
 *   integrations: [githubIntegration({ clientId: '...', clientSecret: '...' })],
 * });
 * 
 * await mcpClient.connect();
 * 
 * const tools = convertMCPToolsToVercelAI(mcpClient);
 * 
 * const result = await generateText({
 *   model: openai('gpt-5'),
 *   prompt: 'Create a GitHub issue in my repo',
 *   tools,
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with token passing
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * 
 * const { client: serverClient } = createMCPServer({
 *   integrations: [githubIntegration({ clientId: '...', clientSecret: '...' })],
 * });
 * 
 * // In your API route handler
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   
 *   const tools = convertMCPToolsToVercelAI(serverClient, { providerTokens });
 *   
 *   const result = await generateText({
 *     model: openai('gpt-4'),
 *     prompt: 'Create a GitHub issue',
 *     tools,
 *   });
 *   
 *   return Response.json(result);
 * }
 * ```
 */
export function convertMCPToolsToVercelAI(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
): Record<string, any> {
  const mcpTools = client.getEnabledTools();
  const vercelTools: Record<string, any> = {};

  for (const mcpTool of mcpTools) {
    vercelTools[mcpTool.name] = convertMCPToolToVercelAI(mcpTool, client, options);
  }

  return vercelTools;
}

/**
 * Get tools in a format compatible with Vercel AI SDK v5's tools parameter
 * 
 * This returns the tools in the exact format expected by ai.generateText() and ai.streamText()
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Tools object ready to pass to generateText({ tools: ... }) or streamText({ tools: ... })
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = await getVercelAITools(mcpClient);
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 * const tools = await getVercelAITools(serverClient, { providerTokens });
 * ```
 */
export async function getVercelAITools(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
) {
  // Auto-connect if not connected (lazy connection)
  await ensureClientConnected(client);

  return convertMCPToolsToVercelAI(client, options);
}

