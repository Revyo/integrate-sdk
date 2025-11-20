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
  type VercelAITool,
  type VercelAIToolsOptions,
  
  // OpenAI
  getOpenAITools,
  handleOpenAIResponse,
  type OpenAITool,
  type OpenAIToolsOptions,
  
  // Anthropic
  getAnthropicTools,
  handleAnthropicMessage,
  type AnthropicTool,
  type AnthropicToolsOptions,
  type AnthropicToolUseBlock,
  type AnthropicToolResultBlock,
  
  // Google
  getGoogleTools,
  executeGoogleFunctionCalls,
  type GoogleTool,
  type GoogleFunctionCall,
  type GoogleToolsOptions,
  
  // Utilities
  type AIToolsOptions
} from './src/ai/index.js';
