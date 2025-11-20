/**
 * Vercel AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Vercel AI SDK v5 format
 */

import { z } from "zod";
import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import type { MCPContext } from "../config/types.js";
import {
  jsonSchemaToZod,
  ensureClientConnected,
  getProviderTokens,
  executeToolWithToken,
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
export interface VercelAIToolsOptions extends AIToolsOptions {
  /** User context for multi-tenant token storage */
  context?: MCPContext;
}

/**
 * Convert a single MCP tool to Vercel AI SDK format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens and context
 * @returns Vercel AI SDK compatible tool definition
 */
function convertMCPToolToVercelAI(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
): VercelAITool {
  return {
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    inputSchema: jsonSchemaToZod(mcpTool.inputSchema), // Convert JSON Schema to Zod
    execute: async (args: Record<string, unknown>) => {
      // If providerTokens is provided, use executeToolWithToken (handles token injection)
      if (options?.providerTokens) {
        return await executeToolWithToken(client, mcpTool.name, args, options);
      }

      // Otherwise, pass context through to _callToolByName for token callbacks
      return await client._callToolByName(mcpTool.name, args, options?.context ? { context: options.context } : undefined);
    },
  };
}


/**
 * Get tools in a format compatible with Vercel AI SDK v5's tools parameter
 * 
 * This returns the tools in the exact format expected by ai.generateText() and ai.streamText()
 * Automatically connects the client if not already connected.
 * 
 * **Auto-extraction**: Provider tokens are automatically extracted from request headers
 * or environment variables if not provided in options. This works in supported frameworks
 * like Next.js and Nuxt.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Tools object ready to pass to generateText({ tools: ... }) or streamText({ tools: ... })
 * 
 * @example
 * ```typescript
 * // Auto-extraction (recommended) - tokens extracted automatically
 * import { serverClient } from '@/lib/integrate-server';
 * import { getVercelAITools } from 'integrate-sdk';
 * import { streamText } from 'ai';
 * 
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   const userId = await getUserIdFromSession(req);
 *   
 *   const result = streamText({
 *     model: "openai/gpt-4",
 *     messages,
 *     tools: await getVercelAITools(serverClient, { context: { userId } }), // Pass user context
 *   });
 *   
 *   return result.toUIMessageStreamResponse();
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual override when auto-extraction isn't available
 * const tools = await getVercelAITools(serverClient, {
 *   providerTokens: {
 *     github: 'ghp_...',
 *     gmail: 'ya29...'
 *   }
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Client-side usage (no tokens needed)
 * const tools = await getVercelAITools(mcpClient);
 * ```
 */
export async function getVercelAITools(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
) {
  // Auto-connect if not connected (lazy connection)
  await ensureClientConnected(client);

  // Auto-extract tokens if not provided
  let providerTokens = options?.providerTokens;
  if (!providerTokens) {
    try {
      providerTokens = await getProviderTokens();
    } catch {
      // Token extraction failed - that's okay, tools may work without tokens
      // or this may be client-side usage where tokens aren't needed
    }
  }

  const finalOptions = providerTokens ? { ...options, providerTokens } : options;
  const mcpTools = client.getEnabledTools();
  const vercelTools: Record<string, any> = {};

  for (const mcpTool of mcpTools) {
    vercelTools[mcpTool.name] = convertMCPToolToVercelAI(mcpTool, client, finalOptions);
  }

  return vercelTools;
}

