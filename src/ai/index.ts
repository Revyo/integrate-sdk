/**
 * AI Provider Integrations
 * 
 * Unified interface for all AI provider integrations
 */

// Re-export allowed provider integrations
export {
  getVercelAITools,
  type VercelAITool,
  type VercelAIToolsOptions
} from "./vercel-ai.js";

export {
  getOpenAITools,
  handleOpenAIResponse,
  type OpenAITool,
  type OpenAIToolsOptions
} from "./openai.js";

export {
  getAnthropicTools,
  handleAnthropicMessage,
  type AnthropicTool,
  type AnthropicToolsOptions,
  type AnthropicToolUseBlock,
  type AnthropicToolResultBlock
} from "./anthropic.js";

export {
  getGoogleTools,
  executeGoogleFunctionCalls,
  type GoogleTool,
  type GoogleFunctionCall,
  type GoogleToolsOptions
} from "./google.js";

export type { AIToolsOptions } from "./utils.js";
