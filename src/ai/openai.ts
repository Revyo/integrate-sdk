/**
 * OpenAI Responses API Integration
 * 
 * Helper functions to convert MCP tools to OpenAI Responses API format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, getProviderTokens, type AIToolsOptions } from "./utils.js";
import type { OpenAI } from "openai";

/**
 * OpenAI function tool definition
 * Compatible with OpenAI's Responses API format
 */
export interface OpenAITool {
  type: 'function';
  name: string;
  parameters: {
    [key: string]: unknown;
  } | null;
  strict: boolean | null;
  description?: string | null;
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
  _client: MCPClient<any>,
  options?: OpenAIToolsOptions
): OpenAITool {
  const inputParams = mcpTool.inputSchema;

  return {
    type: 'function',
    name: mcpTool.name,
    parameters: inputParams as { [key: string]: unknown } || null,
    strict: options?.strict ?? null,
    description: mcpTool.description || null,
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
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to pass to OpenAI's Responses API
 * 
 * @example
 * ```typescript
 * // Auto-extraction (recommended)
 * import { serverClient } from '@/lib/integrate-server';
 * import { getOpenAITools, executeOpenAIToolCall } from 'integrate-sdk';
 * 
 * export async function POST(req: Request) {
 *   const tools = await getOpenAITools(serverClient); // Tokens auto-extracted
 *   
 *   const response = await openai.responses.create({
 *     model: 'gpt-4o-2024-11-20',
 *     input: 'Create a GitHub issue',
 *     tools,
 *   });
 *   
 *   return Response.json(response);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual override
 * const tools = await getOpenAITools(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export async function getOpenAITools(
  client: MCPClient<any>,
  options?: OpenAIToolsOptions
): Promise<OpenAITool[]> {
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
  return convertMCPToolsToOpenAI(client, finalOptions);
}

/**
 * Handle multiple tool calls from OpenAI's response output
 * 
 * This function processes all function_call items from the response output,
 * executes each tool call, and returns formatted results for the next request.
 * 
 * @param client - The MCP client instance
 * @param toolCalls - Array of output items from OpenAI response (filters for function_call type)
 * @param options - Optional configuration including provider tokens
 * @returns Array of function call outputs to send back to OpenAI
 * 
 * @example
 * ```typescript
 * // Handle tool calls from a response
 * const response = await openai.responses.create({
 *   model: 'gpt-4o-2024-11-20',
 *   input: 'Create a GitHub issue',
 *   tools: await getOpenAITools(serverClient),
 * });
 * 
 * // Execute the tool calls and get outputs
 * const toolOutputs = await handleOpenAIToolCalls(
 *   serverClient,
 *   response.output,
 *   { providerTokens }
 * );
 * 
 * // Continue the conversation with tool results
 * const nextResponse = await openai.responses.create({
 *   model: 'gpt-4o-2024-11-20',
 *   input: toolOutputs,
 *   tools: await getOpenAITools(serverClient),
 * });
 * ```
 */
export async function handleOpenAIToolCalls(
  client: MCPClient<any>,
  toolCalls: OpenAI.Responses.ResponseOutputItem[],
  options?: OpenAIToolsOptions
): Promise<OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]> {
  const toolOutputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = [];

  for (const output of toolCalls) {
    if (output.type === 'function_call') {
      const toolCall = {
        id: output.id ?? '',
        name: output.name,
        arguments: output.arguments,
      };

      try {
        const result = await executeOpenAIToolCall(client, toolCall, options);
        toolOutputs.push({
          call_id: output.call_id ?? output.id ?? '',
          type: 'function_call_output',
          output: result,
          status: 'completed',
        });
      } catch (error) {
        toolOutputs.push({
          call_id: output.call_id ?? output.id ?? '',
          type: 'function_call_output',
          output: error instanceof Error ? error.message : 'Unknown error',
          status: 'incomplete',
        });
      }
    }
  }

  return toolOutputs;
}

/**
 * Handle an entire OpenAI Response object
 * 
 * This is a convenience function that extracts tool calls from a Response
 * object and executes them. Use this when you want to process all tool
 * calls from a response in one go.
 * 
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options.
 * 
 * @param client - The MCP client instance
 * @param response - The complete Response object from OpenAI
 * @param options - Optional configuration including provider tokens
 * @returns Array of function call outputs to send back to OpenAI
 * 
 * @example
 * ```typescript
 * import { serverClient } from '@/lib/integrate-server';
 * import { getOpenAITools, handleOpenAIResponse } from 'integrate-sdk/server';
 * import OpenAI from 'openai';
 * 
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * 
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   
 *   // Initial request with tools
 *   const response = await openai.responses.create({
 *     model: 'gpt-4o-2024-11-20',
 *     input: messages,
 *     tools: await getOpenAITools(serverClient),
 *   });
 *   
 *   // If there are tool calls, handle them automatically
 *   if (response.output.some(item => item.type === 'function_call')) {
 *     const toolOutputs = await handleOpenAIResponse(serverClient, response);
 *     
 *     // Continue conversation with tool results
 *     const finalResponse = await openai.responses.create({
 *       model: 'gpt-4o-2024-11-20',
 *       input: toolOutputs,
 *       tools: await getOpenAITools(serverClient),
 *     });
 *     
 *     return Response.json(finalResponse);
 *   }
 *   
 *   return Response.json(response);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual token override
 * const toolOutputs = await handleOpenAIResponse(serverClient, response, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export async function handleOpenAIResponse(
  client: MCPClient<any>,
  response: OpenAI.Responses.Response,
  options?: OpenAIToolsOptions
): Promise<OpenAI.Responses.ResponseInputItem.FunctionCallOutput[]> {
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

  // Filter and execute function calls
  const functionCalls = response.output.filter(
    (output: OpenAI.Responses.ResponseOutputItem): output is OpenAI.Responses.ResponseOutputItem & { type: 'function_call' } =>
      output.type === 'function_call'
  );

  return handleOpenAIToolCalls(client, functionCalls, finalOptions);
}

