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

export * from './src/server.js';
export * from './src/ai/index.js';
export * from './src/adapters/index.js';

