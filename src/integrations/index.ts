/**
 * AI Provider Integrations
 * 
 * Unified interface for all AI provider integrations
 */

import type { MCPClient } from "../client.js";
import type { AIToolsOptions } from "./utils.js";

// Re-export all provider integrations
export * from "./vercel-ai.js";
export * from "./openai.js";
export * from "./openai-agents.js";
export * from "./anthropic.js";
export * from "./google.js";
export * from "./cloudflare.js";
export * from "./langchain.js";
export * from "./llamaindex.js";
export * from "./mastra.js";
export * from "./utils.js";

// Import provider-specific functions
import { getVercelAITools } from "./vercel-ai.js";
import { getOpenAITools } from "./openai.js";
import { getOpenAIAgentsTools } from "./openai-agents.js";
import { getAnthropicTools } from "./anthropic.js";
import { getGoogleTools } from "./google.js";
import { getCloudflareTools } from "./cloudflare.js";
import { getLangChainTools } from "./langchain.js";
import { getLlamaIndexTools } from "./llamaindex.js";
import { getMastraTools } from "./mastra.js";

/**
 * Supported AI provider names
 */
export type AIProviderName =
  | "vercel-ai"
  | "openai"
  | "openai-agents"
  | "anthropic"
  | "google"
  | "cloudflare"
  | "langchain"
  | "llamaindex"
  | "mastra";

/**
 * Generic function to get AI tools for any supported provider
 * 
 * This provides a unified interface for getting tools from any AI provider.
 * Use this when you want to dynamically switch between providers or support multiple providers.
 * 
 * @param client - The MCP client instance
 * @param provider - The AI provider name
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Tools in the format expected by the specified provider
 * 
 * @example
 * ```typescript
 * // Dynamic provider selection
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { getAITools } from 'integrate-sdk/integrations';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * // Choose provider at runtime
 * const provider = process.env.AI_PROVIDER || 'openai';
 * const tools = await getAITools(client, provider as any);
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side with provider tokens
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { getAITools } from 'integrate-sdk/integrations';
 * 
 * const { client: serverClient } = createMCPServer({
 *   plugins: [githubPlugin({ 
 *     clientId: '...', 
 *     clientSecret: '...' 
 *   })],
 * });
 * 
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   
 *   // Support multiple providers
 *   const tools = await getAITools(serverClient, 'anthropic', { providerTokens });
 *   // ... use with Anthropic SDK
 * }
 * ```
 */
export async function getAITools(
  client: MCPClient<any>,
  provider: "vercel-ai",
  options?: AIToolsOptions
): Promise<Record<string, any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "openai",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "openai-agents",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "anthropic",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "google",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "cloudflare",
  options?: AIToolsOptions
): Promise<Record<string, any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "langchain",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "llamaindex",
  options?: AIToolsOptions
): Promise<Array<any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: "mastra",
  options?: AIToolsOptions
): Promise<Record<string, any>>;

export async function getAITools(
  client: MCPClient<any>,
  provider: AIProviderName,
  options?: AIToolsOptions
): Promise<any> {
  switch (provider) {
    case "vercel-ai":
      return await getVercelAITools(client, options);
    case "openai":
      return await getOpenAITools(client, options);
    case "openai-agents":
      return await getOpenAIAgentsTools(client, options);
    case "anthropic":
      return await getAnthropicTools(client, options);
    case "google":
      return await getGoogleTools(client, options);
    case "cloudflare":
      return await getCloudflareTools(client, options);
    case "langchain":
      return await getLangChainTools(client, options);
    case "llamaindex":
      return await getLlamaIndexTools(client, options);
    case "mastra":
      return await getMastraTools(client, options);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

