/**
 * Anthropic Claude Integration
 * 
 * Helper functions to convert MCP tools to Anthropic Claude API format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, getProviderTokens, type AIToolsOptions } from "./utils.js";
import type Anthropic from "@anthropic-ai/sdk";

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
export interface AnthropicToolsOptions extends AIToolsOptions { }

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
  _client: MCPClient<any>,
  _options?: AnthropicToolsOptions
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
  messageContent: Array<{ type: string;[key: string]: any }>,
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
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to pass to Claude API
 * 
 * @example
 * ```typescript
 * // Auto-extraction (recommended)
 * import { serverClient } from '@/lib/integrate-server';
 * import { getAnthropicTools, handleAnthropicToolCalls } from 'integrate-sdk';
 * import Anthropic from '@anthropic-ai/sdk';
 * 
 * export async function POST(req: Request) {
 *   const tools = await getAnthropicTools(serverClient); // Tokens auto-extracted
 *   
 *   const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *   const message = await anthropic.messages.create({
 *     model: 'claude-3-5-sonnet-20241022',
 *     max_tokens: 1024,
 *     tools,
 *     messages: [{ role: 'user', content: 'Create a GitHub issue' }]
 *   });
 *   
 *   return Response.json(message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual override
 * const tools = await getAnthropicTools(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export async function getAnthropicTools(
  client: MCPClient<any>,
  options?: AnthropicToolsOptions
): Promise<AnthropicTool[]> {
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
  return convertMCPToolsToAnthropic(client, finalOptions);
}

/**
 * Handle an entire Anthropic Message object
 * 
 * This is a convenience function that extracts tool calls from a Message
 * object, executes them, and returns the results formatted as MessageParam
 * ready to be passed directly to the next API call.
 * 
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options.
 * 
 * @param client - The MCP client instance
 * @param message - The complete Message object from Anthropic
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution results as MessageParam[] if tools were called, otherwise returns the original message
 * 
 * @example
 * ```typescript
 * import { serverClient } from '@/lib/integrate-server';
 * import { getAnthropicTools, handleAnthropicMessage } from 'integrate-sdk/server';
 * import Anthropic from '@anthropic-ai/sdk';
 * 
 * const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 * 
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   
 *   const message = await anthropic.messages.create({
 *     model: 'claude-3-5-sonnet-20241022',
 *     max_tokens: 1024,
 *     tools: await getAnthropicTools(serverClient),
 *     messages,
 *   });
 *   
 *   const result = await handleAnthropicMessage(serverClient, message);
 *   
 *   return Response.json(result);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual token override
 * const toolMessages = await handleAnthropicMessage(serverClient, message, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export async function handleAnthropicMessage(
  client: MCPClient<any>,
  message: { role: string; content: Array<{ type: string;[key: string]: any }> } & Record<string, any>,
  options?: AnthropicToolsOptions
): Promise<Anthropic.Messages.MessageParam[] | ({ role: string; content: Array<{ type: string;[key: string]: any }> } & Record<string, any>)> {
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

  // Execute all tool calls and get results
  const toolResults = await handleAnthropicToolCalls(client, message.content, finalOptions);

  // If no tool results, return the original message
  if (toolResults.length === 0) {
    return message;
  }

  // Format as MessageParams:
  // 1. The assistant message (containing the tool use)
  // 2. The user message (containing the tool results)
  return [
    {
      role: message.role as 'assistant',
      content: message.content as any,
    },
    {
      role: 'user',
      content: toolResults,
    },
  ];
}

