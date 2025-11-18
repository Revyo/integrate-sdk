/**
 * Server-Side SDK Entry Point
 * Re-exports from src/server.ts for convenience
 * 
 * Use this import for server-side configuration with OAuth secrets:
 * ```typescript
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * ```
 * 
 * Also includes AI tools (server-side only):
 * ```typescript
 * import { getVercelAITools, getOpenAITools } from 'integrate-sdk/server';
 * ```
 * 
 * And framework adapters:
 * ```typescript
 * import { createNextOAuthHandler, toSvelteKitHandler } from 'integrate-sdk/server';
 * ```
 */

// Core server exports
export * from './src/server.js';

// Framework adapter exports  
export * from './src/adapters/index.js';

// AI provider exports - explicitly imported to prevent tree-shaking
export {
  // Vercel AI
  getVercelAITools,
  convertMCPToolsToVercelAI,
  convertMCPToolToVercelAI,
  // OpenAI
  getOpenAITools,
  convertMCPToolsToOpenAI,
  convertMCPToolToOpenAI,
  executeOpenAIToolCall,
  // Anthropic
  getAnthropicTools,
  convertMCPToolsToAnthropic,
  convertMCPToolToAnthropic,
  executeAnthropicToolCall,
  // Google
  getGoogleTools,
  convertMCPToolsToGoogle,
  convertMCPToolToGoogle,
  executeGoogleFunctionCall,
  executeGoogleFunctionCalls,
  // Cloudflare
  getCloudflareTools,
  convertMCPToolsToCloudflare,
  convertMCPToolToCloudflare,
  executeCloudflareToolCall,
  // LangChain
  getLangChainTools,
  convertMCPToolsToLangChain,
  convertMCPToolToLangChain,
  // LlamaIndex
  getLlamaIndexTools,
  convertMCPToolsToLlamaIndex,
  convertMCPToolToLlamaIndex,
  // Mastra
  getMastraTools,
  convertMCPToolsToMastra,
  convertMCPToolToMastra,
  // Unified interface
  getAITools,
  // Utilities
  getProviderForTool,
  executeToolWithToken,
  // Types
  type AIProviderName,
  type AIToolsOptions,
  type VercelAITool,
  type OpenAITool,
  type AnthropicTool,
  type GoogleTool,
  type CloudflareTool,
} from './src/ai/index.js';

