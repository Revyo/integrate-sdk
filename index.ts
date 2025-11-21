/**
 * Integrate SDK - Main Entry Point
 * 
 * Client-side SDK for MCP with integration-based configuration
 * 
 * @example
 * ```typescript
 * // Use the default client with all integrations
 * import { client } from 'integrate-sdk';
 * 
 * await client.github.listOwnRepos({});
 * 
 * // Or create a custom client with different API configuration
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * 
 * // Example 1: Different API path (same origin)
 * const customClient = createMCPClient({
 *   apiRouteBase: '/custom/api/path', // Calls /custom/api/path/mcp
 *   integrations: [githubIntegration()],
 * });
 * 
 * // Example 2: Different API domain (cross-origin)
 * const crossOriginClient = createMCPClient({
 *   apiBaseUrl: 'https://api.example.com', // API on different domain
 *   apiRouteBase: '/api/integrate', // Calls https://api.example.com/api/integrate/mcp
 *   integrations: [githubIntegration()],
 * });
 * ```
 */

export * from './src/index.js';

// Export default client with all integrations pre-configured
import { createMCPClient } from './src/client.js';
import { githubIntegration } from './src/integrations/github.js';
import { gmailIntegration } from './src/integrations/gmail.js';
import { notionIntegration } from './src/integrations/notion.js';

/**
 * Default MCP Client with all integrations pre-configured
 * 
 * This is a singleton client instance that includes GitHub and Gmail integrations.
 * You can use it directly without having to configure integrations.
 * 
 * Default configuration:
 * - Calls API routes at: {window.location.origin}/api/integrate/mcp
 * - OAuth routes at: {window.location.origin}/api/integrate/oauth/*
 * - Does NOT save tokens to localStorage (tokens are managed server-side)
 * 
 * For custom configuration (different apiBaseUrl, apiRouteBase, localStorage, etc.),
 * use `createMCPClient()` instead.
 * 
 * @example
 * ```typescript
 * import { client } from 'integrate-sdk';
 * 
 * // Use GitHub integration
 * const repos = await client.github.listOwnRepos({});
 * 
 * // Use Gmail integration
 * const messages = await client.gmail.listMessages({});
 * ```
 * 
 * @example
 * ```typescript
 * // If you need localStorage or custom config, create your own client:
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * 
 * const customClient = createMCPClient({
 *   integrations: [githubIntegration()],
 *   skipLocalStorage: false, // Enable localStorage if needed
 * });
 * ```
 */
export const client = createMCPClient({
  integrations: [
    githubIntegration(),
    gmailIntegration(),
    notionIntegration(),
  ],
  // Default client doesn't use localStorage - tokens are managed server-side
  // If you need localStorage, create your own client with createMCPClient()
  skipLocalStorage: true,
});

