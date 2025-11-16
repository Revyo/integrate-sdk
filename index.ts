/**
 * Integrate SDK - Main Entry Point
 * 
 * Client-side SDK for MCP with integration-based configuration
 * 
 * @example
 * ```typescript
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   integrations: [
 *     githubIntegration({
 *       scopes: ['repo', 'user'],
 *     }),
 *   ],
 * });
 * ```
 */

export * from './src/index.js';

