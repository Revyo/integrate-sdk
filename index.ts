/**
 * Integrate SDK - Main Entry Point
 * 
 * Client-side SDK for MCP with plugin-based configuration
 * 
 * @example
 * ```typescript
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   plugins: [
 *     githubPlugin({
 *       scopes: ['repo', 'user'],
 *     }),
 *   ],
 * });
 * ```
 */

export * from './src/index.js';

