/**
 * OpenAI Responses API Integration
 * 
 * Helper functions to convert MCP tools to OpenAI Responses API format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, type AIToolsOptions } from "./utils.js";

/**
 * OpenAI function tool definition
 * Compatible with OpenAI's Responses API format
 */
export interface OpenAITool {
  type: 'function';
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
  strict?: boolean;
}

/**
 * Options for converting MCP tools to OpenAI format
 */
export interface OpenAIToolsOptions extends AIToolsOptions {
  /**
   * Whether to use strict mode for function calls
   * @default false
   */
  strict?: boolean;
}

/**
 * Convert a single MCP tool to OpenAI Responses API format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens and strict mode
 * @returns OpenAI compatible tool definition
 * 
 * @example
 * ```typescript
 * const openaiTool = convertMCPToolToOpenAI(mcpTool, client, { strict: true });
 * ```
 */
export function convertMCPToolToOpenAI(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: OpenAIToolsOptions
): OpenAITool {
  const inputParams = mcpTool.inputSchema;
  
  return {
    type: 'function',
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters: inputParams || {
      type: 'object',
      properties: {},
      required: [],
    },
    strict: options?.strict ?? false,
  };
}

/**
 * Convert all enabled MCP tools to OpenAI Responses API format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens and strict mode
 * @returns Array of OpenAI compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToOpenAI(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToOpenAI(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToOpenAI(
  client: MCPClient<any>,
  options?: OpenAIToolsOptions
): OpenAITool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToOpenAI(mcpTool, client, options));
}

/**
 * Execute a tool call from OpenAI's response
 * 
 * @param client - The MCP client instance
 * @param toolCall - The tool call from OpenAI response
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution result as JSON string
 * 
 * @example
 * ```typescript
 * const result = await executeOpenAIToolCall(client, {
 *   id: 'call_123',
 *   name: 'github_create_issue',
 *   arguments: '{"owner":"user","repo":"repo","title":"Bug"}'
 * }, { providerTokens });
 * ```
 */
export async function executeOpenAIToolCall(
  client: MCPClient<any>,
  toolCall: {
    id: string;
    name: string;
    arguments: string;
  },
  options?: OpenAIToolsOptions
): Promise<string> {
  const args = JSON.parse(toolCall.arguments);
  const result = await executeToolWithToken(client, toolCall.name, args, options);
  return JSON.stringify(result);
}

/**
 * Get tools in a format compatible with OpenAI Responses API
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to pass to OpenAI's Responses API
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getOpenAITools } from 'integrate-sdk/integrations/openai';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * const tools = await getOpenAITools(client);
 * 
 * // Use with OpenAI SDK
 * const response = await openai.responses.create({
 *   model: 'gpt-4o-2024-11-20',
 *   input: 'Create a GitHub issue',
 *   tools,
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getOpenAITools, executeOpenAIToolCall } from 'integrate-sdk/integrations/openai';
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
 *   const tools = await getOpenAITools(serverClient, { providerTokens });
 *   
 *   const response = await openai.responses.create({
 *     model: 'gpt-4o-2024-11-20',
 *     input: 'Create a GitHub issue',
 *     tools,
 *   });
 *   
 *   // Handle tool calls
 *   const toolCalls = response.output.filter(o => o.type === 'function_call');
 *   for (const toolCall of toolCalls) {
 *     const result = await executeOpenAIToolCall(serverClient, {
 *       id: toolCall.id,
 *       name: toolCall.name,
 *       arguments: toolCall.arguments,
 *     }, { providerTokens });
 *   }
 *   
 *   return Response.json(response);
 * }
 * ```
 */
export async function getOpenAITools(
  client: MCPClient<any>,
  options?: OpenAIToolsOptions
): Promise<OpenAITool[]> {
  await ensureClientConnected(client);
  return convertMCPToolsToOpenAI(client, options);
}

