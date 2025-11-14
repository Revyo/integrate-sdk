/**
 * LangChain Integration
 * 
 * Helper functions to convert MCP tools to LangChain DynamicStructuredTool format
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
 * LangChain DynamicStructuredTool definition
 * Compatible with @langchain/core/tools
 */
export interface LangChainTool {
  name: string;
  description: string;
  schema: z.ZodType<any>;
  func: (...args: any[]) => Promise<string>;
}

/**
 * Options for converting MCP tools to LangChain format
 */
export interface LangChainToolsOptions extends AIToolsOptions {}

/**
 * Convert a single MCP tool to LangChain DynamicStructuredTool format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns LangChain compatible tool definition
 * 
 * @example
 * ```typescript
 * const langchainTool = convertMCPToolToLangChain(mcpTool, client);
 * ```
 */
export function convertMCPToolToLangChain(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: LangChainToolsOptions
): LangChainTool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    schema: jsonSchemaToZod(mcpTool.inputSchema),
    func: async (...args: any[]) => {
      // LangChain passes the args as the first parameter
      const input = args[0] as Record<string, unknown>;
      const result = await executeToolWithToken(client, mcpTool.name, input, options);
      return JSON.stringify(result);
    },
  };
}

/**
 * Convert all enabled MCP tools to LangChain DynamicStructuredTool format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of LangChain compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToLangChain(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToLangChain(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToLangChain(
  client: MCPClient<any>,
  options?: LangChainToolsOptions
): LangChainTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToLangChain(mcpTool, client, options));
}

/**
 * Get tools in a format compatible with LangChain
 * 
 * Automatically connects the client if not already connected.
 * Returns tool definitions that can be used with DynamicStructuredTool.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with LangChain
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getLangChainTools } from 'integrate-sdk/integrations/langchain';
 * import { DynamicStructuredTool } from '@langchain/core/tools';
 * import { ChatOpenAI } from '@langchain/openai';
 * import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * const toolConfigs = await getLangChainTools(client);
 * 
 * // Create DynamicStructuredTools from configs
 * const tools = toolConfigs.map(config => 
 *   new DynamicStructuredTool(config)
 * );
 * 
 * const model = new ChatOpenAI({ temperature: 0 });
 * const agent = await createOpenAIFunctionsAgent({
 *   llm: model,
 *   tools
 * });
 * 
 * const executor = new AgentExecutor({ agent, tools });
 * const result = await executor.invoke({
 *   input: "Create a GitHub issue"
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getLangChainTools } from 'integrate-sdk/integrations/langchain';
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
 *   const toolConfigs = await getLangChainTools(serverClient, { providerTokens });
 *   
 *   // Create DynamicStructuredTools
 *   const tools = toolConfigs.map(config => 
 *     new DynamicStructuredTool(config)
 *   );
 *   
 *   const model = new ChatOpenAI({ temperature: 0 });
 *   const agent = await createOpenAIFunctionsAgent({
 *     llm: model,
 *     tools
 *   });
 *   
 *   const executor = new AgentExecutor({ agent, tools });
 *   const result = await executor.invoke({
 *     input: "Create a GitHub issue"
 *   });
 *   
 *   return Response.json(result);
 * }
 * ```
 */
export async function getLangChainTools(
  client: MCPClient<any>,
  options?: LangChainToolsOptions
): Promise<LangChainTool[]> {
  await ensureClientConnected(client);
  return convertMCPToolsToLangChain(client, options);
}

