/**
 * Google GenAI Integration
 * 
 * Helper functions to convert MCP tools to Google GenAI format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, getProviderTokens, type AIToolsOptions } from "./utils.js";

/**
 * Google GenAI function declaration
 * Compatible with @google/genai SDK
 */
export interface GoogleTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    description?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Google GenAI function call
 */
export interface GoogleFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Options for converting MCP tools to Google GenAI format
 */
export interface GoogleToolsOptions extends AIToolsOptions { }

/**
 * Convert a single MCP tool to Google GenAI format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Google GenAI compatible tool definition
 * 
 * @example
 * ```typescript
 * const googleTool = convertMCPToolToGoogle(mcpTool, client);
 * ```
 */
export function convertMCPToolToGoogle(
  mcpTool: MCPTool,
  _client: MCPClient<any>,
  _options?: GoogleToolsOptions
): GoogleTool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters: {
      type: 'object',
      description: mcpTool.description || '',
      properties: mcpTool.inputSchema?.properties || {},
      required: mcpTool.inputSchema?.required || [],
    },
  };
}

/**
 * Convert all enabled MCP tools to Google GenAI format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of Google GenAI compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToGoogle(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToGoogle(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToGoogle(
  client: MCPClient<any>,
  options?: GoogleToolsOptions
): GoogleTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToGoogle(mcpTool, client, options));
}

/**
 * Execute a function call from Google GenAI
 * 
 * @param client - The MCP client instance
 * @param functionCall - The function call from Google GenAI response
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution result as JSON string
 * 
 * @example
 * ```typescript
 * const result = await executeGoogleFunctionCall(client, {
 *   name: 'github_create_issue',
 *   args: { owner: 'user', repo: 'repo', title: 'Bug' }
 * }, { providerTokens });
 * ```
 */
export async function executeGoogleFunctionCall(
  client: MCPClient<any>,
  functionCall: GoogleFunctionCall,
  options?: GoogleToolsOptions
): Promise<string> {
  const result = await executeToolWithToken(client, functionCall.name, functionCall.args, options);
  return JSON.stringify(result);
}

/**
 * Get tools in a format compatible with Google GenAI
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with Google GenAI
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { getGoogleTools } from 'integrate-sdk/ai/google';
 * import { GoogleGenerativeAI } from '@google/generative-ai';
 * 
 * const client = createMCPClient({
 *   integrations: [githubIntegration({ clientId: '...' })],
 * });
 * 
 * const tools = await getGoogleTools(client);
 * const genAI = new GoogleGenerativeAI('YOUR_API_KEY');
 * const model = genAI.getGenerativeModel({ 
 *   model: 'gemini-pro',
 *   tools: [{ functionDeclarations: tools }]
 * });
 * 
 * const result = await model.generateContent({
 *   contents: [{ role: 'user', parts: [{ text: 'Create a GitHub issue' }] }]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * import { getGoogleTools, executeGoogleFunctionCall } from 'integrate-sdk/ai/google';
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
 *   const tools = await getGoogleTools(serverClient, { providerTokens });
 *   
 *   const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
 *   const model = genAI.getGenerativeModel({ 
 *     model: 'gemini-pro',
 *     tools: [{ functionDeclarations: tools }]
 *   });
 *   
 *   const result = await model.generateContent({
 *     contents: [{ role: 'user', parts: [{ text: 'Create a GitHub issue' }] }]
 *   });
 *   
 *   // Handle function calls if any
 *   const functionCalls = result.response.functionCalls();
 *   if (functionCalls) {
 *     for (const call of functionCalls) {
 *       await executeGoogleFunctionCall(serverClient, call, { providerTokens });
 *     }
 *   }
 *   
 *   return Response.json(result.response);
 * }
 * ```
 */
export async function getGoogleTools(
  client: MCPClient<any>,
  options?: GoogleToolsOptions
): Promise<GoogleTool[]> {
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
  return convertMCPToolsToGoogle(client, finalOptions);
}

