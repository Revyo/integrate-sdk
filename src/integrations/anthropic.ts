/**
 * Anthropic Claude Integration
 * 
 * Helper functions to convert MCP tools to Anthropic Claude API format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, type AIToolsOptions } from "./utils.js";

/**
 * Anthropic tool definition
 * Compatible with Anthropic's Claude API
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Options for converting MCP tools to Anthropic format
 */
export interface AnthropicToolsOptions extends AIToolsOptions {}

/**
 * Anthropic tool use block from message content
 */
export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Anthropic tool result block for responses
 */
export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

/**
 * Convert a single MCP tool to Anthropic Claude API format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Anthropic compatible tool definition
 * 
 * @example
 * ```typescript
 * const anthropicTool = convertMCPToolToAnthropic(mcpTool, client);
 * ```
 */
export function convertMCPToolToAnthropic(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: AnthropicToolsOptions
): AnthropicTool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    input_schema: mcpTool.inputSchema || {
      type: 'object',
      properties: {},
      required: [],
    },
  };
}

/**
 * Convert all enabled MCP tools to Anthropic Claude API format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of Anthropic compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToAnthropic(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToAnthropic(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToAnthropic(
  client: MCPClient<any>,
  options?: AnthropicToolsOptions
): AnthropicTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToAnthropic(mcpTool, client, options));
}

/**
 * Execute a tool call from Anthropic's response
 * 
 * @param client - The MCP client instance
 * @param toolUse - The tool use block from Anthropic response
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution result as JSON string
 * 
 * @example
 * ```typescript
 * const result = await executeAnthropicToolCall(client, {
 *   type: 'tool_use',
 *   id: 'toolu_123',
 *   name: 'github_create_issue',
 *   input: { owner: 'user', repo: 'repo', title: 'Bug' }
 * }, { providerTokens });
 * ```
 */
export async function executeAnthropicToolCall(
  client: MCPClient<any>,
  toolUse: AnthropicToolUseBlock,
  options?: AnthropicToolsOptions
): Promise<string> {
  const result = await executeToolWithToken(client, toolUse.name, toolUse.input, options);
  return JSON.stringify(result);
}

/**
 * Handle all tool calls from Anthropic's message response
 * Executes all tool use blocks and returns tool result blocks
 * 
 * @param client - The MCP client instance
 * @param messageContent - Array of content blocks from Anthropic message
 * @param options - Optional configuration including provider tokens
 * @returns Array of tool result blocks ready to send back to Claude
 * 
 * @example
 * ```typescript
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   tools,
 *   messages: [{ role: 'user', content: 'Create a GitHub issue' }]
 * });
 * 
 * // Handle tool calls
 * const toolResults = await handleAnthropicToolCalls(
 *   client,
 *   response.content,
 *   { providerTokens }
 * );
 * 
 * // Continue conversation with tool results
 * const finalResponse = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   tools,
 *   messages: [
 *     { role: 'user', content: 'Create a GitHub issue' },
 *     { role: 'assistant', content: response.content },
 *     { role: 'user', content: toolResults }
 *   ]
 * });
 * ```
 */
export async function handleAnthropicToolCalls(
  client: MCPClient<any>,
  messageContent: Array<{ type: string; [key: string]: any }>,
  options?: AnthropicToolsOptions
): Promise<AnthropicToolResultBlock[]> {
  const toolResults: AnthropicToolResultBlock[] = [];
  
  // Filter for tool_use blocks
  const toolUseBlocks = messageContent.filter(
    (block): block is AnthropicToolUseBlock => 
      block.type === 'tool_use' && 
      'id' in block && 
      'name' in block && 
      'input' in block
  );
  
  // Execute each tool call
  for (const toolUse of toolUseBlocks) {
    try {
      const result = await executeAnthropicToolCall(client, toolUse, options);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    } catch (error) {
      // Return error as tool result
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      });
    }
  }
  
  return toolResults;
}

/**
 * Get tools in a format compatible with Anthropic Claude API
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to pass to Claude API
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getAnthropicTools } from 'integrate-sdk/integrations/anthropic';
 * import Anthropic from '@anthropic-ai/sdk';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * const tools = await getAnthropicTools(client);
 * const anthropic = new Anthropic({ apiKey: '...' });
 * 
 * const message = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   tools,
 *   messages: [{ role: 'user', content: 'Create a GitHub issue' }]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getAnthropicTools, handleAnthropicToolCalls } from 'integrate-sdk/integrations/anthropic';
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
 *   const tools = await getAnthropicTools(serverClient, { providerTokens });
 *   
 *   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const message = await anthropic.messages.create({
 *     model: 'claude-3-5-sonnet-20241022',
 *     max_tokens: 1024,
 *     tools,
 *     messages: [{ role: 'user', content: 'Create a GitHub issue' }]
 *   });
 *   
 *   // Handle any tool calls
 *   const toolResults = await handleAnthropicToolCalls(
 *     serverClient,
 *     message.content,
 *     { providerTokens }
 *   );
 *   
 *   return Response.json({ message, toolResults });
 * }
 * ```
 */
export async function getAnthropicTools(
  client: MCPClient<any>,
  options?: AnthropicToolsOptions
): Promise<AnthropicTool[]> {
  await ensureClientConnected(client);
  return convertMCPToolsToAnthropic(client, options);
}

