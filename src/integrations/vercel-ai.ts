/**
 * Vercel AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Vercel AI SDK v5 format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";

/**
 * Tool definition compatible with Vercel AI SDK v5
 * This matches the CoreTool interface from 'ai' package v5
 */
export interface VercelAITool {
  description?: string;
  parameters: any; // JSON Schema or Zod schema for tool parameters
  execute: (args: any, options?: any) => Promise<any>;
}

/**
 * Options for converting MCP tools to Vercel AI SDK format
 */
export interface VercelAIToolsOptions {
  /**
   * Provider tokens for server-side usage
   * Maps provider names (e.g., 'github', 'gmail') to their access tokens
   * 
   * @example
   * ```typescript
   * const tools = getVercelAITools(serverClient, {
   *   providerTokens: {
   *     github: 'ghp_...',
   *     gmail: 'ya29...'
   *   }
   * });
   * ```
   */
  providerTokens?: Record<string, string>;
}

/**
 * Get the provider for a tool by checking which plugin includes it
 * @internal
 */
function getProviderForTool(client: MCPClient<any>, toolName: string): string | undefined {
  // Access the client's method to get provider for tool
  // This uses the internal method but it's safe since we're in the same SDK
  return (client as any).getProviderForTool?.(toolName);
}

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
    parameters: mcpTool.inputSchema, // MCP tools already use JSON Schema format
    execute: async (args: Record<string, unknown>) => {
      // If provider tokens are provided, inject the appropriate token
      if (options?.providerTokens) {
        const provider = getProviderForTool(client, mcpTool.name);
        if (provider && options.providerTokens[provider]) {
          // Get the transport from the client and set the Authorization header
          const transport = (client as any).transport;
          if (transport && typeof transport.setHeader === 'function') {
            const previousAuthHeader = transport.headers?.['Authorization'];
            
            try {
              // Set the authorization header for this tool call
              transport.setHeader('Authorization', `Bearer ${options.providerTokens[provider]}`);
              
              // Execute the tool with the injected token
              const result = await client._callToolByName(mcpTool.name, args);
              return result;
            } finally {
              // Clean up: restore previous auth header or remove it
              if (previousAuthHeader) {
                transport.setHeader('Authorization', previousAuthHeader);
              } else if (transport.removeHeader) {
                transport.removeHeader('Authorization');
              }
            }
          }
        }
      }
      
      // Use internal method to call tools by name for integration purposes
      const result = await client._callToolByName(mcpTool.name, args);
      return result;
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
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * import { generateText } from 'ai';
 * 
 * const mcpClient = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...', clientSecret: '...' })],
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
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * 
 * const { client: serverClient } = createMCPServer({
 *   plugins: [githubPlugin({ clientId: '...', clientSecret: '...' })],
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
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Tools object ready to pass to generateText({ tools: ... }) or streamText({ tools: ... })
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = getVercelAITools(mcpClient);
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 * const tools = getVercelAITools(serverClient, { providerTokens });
 * ```
 */
export function getVercelAITools(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
) {
  return convertMCPToolsToVercelAI(client, options);
}

