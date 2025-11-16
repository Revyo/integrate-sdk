/**
 * Cloudflare Workers AI Integration
 * 
 * Helper functions to convert MCP tools to Cloudflare Workers AI format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, type AIToolsOptions } from "./utils.js";

/**
 * Cloudflare AI tool definition
 * Compatible with Cloudflare Workers AI
 */
export interface CloudflareTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description?: string;
      }>;
      required: string[];
    };
  };
}

/**
 * Options for converting MCP tools to Cloudflare format
 */
export interface CloudflareToolsOptions extends AIToolsOptions { }

/**
 * Convert a single MCP tool to Cloudflare Workers AI format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Cloudflare compatible tool definition
 * 
 * @example
 * ```typescript
 * const cloudflareTool = convertMCPToolToCloudflare(mcpTool, client);
 * ```
 */
export function convertMCPToolToCloudflare(
  mcpTool: MCPTool,
  _client: MCPClient<any>,
  _options?: CloudflareToolsOptions
): CloudflareTool {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description || `Execute ${mcpTool.name}`,
      parameters: {
        type: 'object',
        properties: mcpTool.inputSchema?.properties || {},
        required: mcpTool.inputSchema?.required || [],
      } as any,
    },
  };
}

/**
 * Convert all enabled MCP tools to Cloudflare Workers AI format
 * Returns a dictionary keyed by tool name
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Dictionary of Cloudflare compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToCloudflare(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToCloudflare(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToCloudflare(
  client: MCPClient<any>,
  options?: CloudflareToolsOptions
): Record<string, CloudflareTool> {
  const mcpTools = client.getEnabledTools();
  const tools: Record<string, CloudflareTool> = {};

  for (const mcpTool of mcpTools) {
    tools[mcpTool.name] = convertMCPToolToCloudflare(mcpTool, client, options);
  }

  return tools;
}

/**
 * Execute a tool call from Cloudflare Workers AI
 * 
 * @param client - The MCP client instance
 * @param toolCall - The tool call with name and arguments
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution result as JSON string
 * 
 * @example
 * ```typescript
 * const result = await executeCloudflareToolCall(client, {
 *   name: 'github_create_issue',
 *   arguments: { owner: 'user', repo: 'repo', title: 'Bug' }
 * }, { providerTokens });
 * ```
 */
export async function executeCloudflareToolCall(
  client: MCPClient<any>,
  toolCall: {
    name: string;
    arguments: Record<string, unknown> | string;
  },
  options?: CloudflareToolsOptions
): Promise<string> {
  const args = typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments;

  const result = await executeToolWithToken(client, toolCall.name, args, options);
  return JSON.stringify(result);
}

/**
 * Get tools in a format compatible with Cloudflare Workers AI
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Dictionary of tools ready to use with Cloudflare Workers AI
 * 
 * @example
 * ```typescript
 * // Cloudflare Worker usage
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { getCloudflareTools, executeCloudflareToolCall } from 'integrate-sdk/ai/cloudflare';
 * 
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const client = createMCPClient({
 *       integrations: [githubIntegration({ clientId: env.GITHUB_CLIENT_ID })],
 *     });
 *     
 *     const tools = await getCloudflareTools(client);
 *     const ai = new Ai(env.AI);
 *     
 *     const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
 *       messages: [{ role: 'user', content: 'Create a GitHub issue' }],
 *       tools: Object.values(tools)
 *     });
 *     
 *     return Response.json(response);
 *   }
 * };
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * import { getCloudflareTools, executeCloudflareToolCall } from 'integrate-sdk/ai/cloudflare';
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
 *   const tools = await getCloudflareTools(serverClient, { providerTokens });
 *   
 *   // Use with Cloudflare AI
 *   const ai = new Ai(env.AI);
 *   const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
 *     messages: [{ role: 'user', content: 'Create a GitHub issue' }],
 *     tools: Object.values(tools)
 *   });
 *   
 *   // Handle tool calls
 *   if (response.tool_calls) {
 *     for (const toolCall of response.tool_calls) {
 *       await executeCloudflareToolCall(serverClient, toolCall, { providerTokens });
 *     }
 *   }
 *   
 *   return Response.json(response);
 * }
 * ```
 */
export async function getCloudflareTools(
  client: MCPClient<any>,
  options?: CloudflareToolsOptions
): Promise<Record<string, CloudflareTool>> {
  await ensureClientConnected(client);
  return convertMCPToolsToCloudflare(client, options);
}

