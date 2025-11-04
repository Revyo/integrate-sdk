/**
 * GitHub Plugin
 * Enables GitHub tools with OAuth configuration
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * GitHub plugin configuration
 * 
 * SERVER-SIDE: Include clientId and clientSecret when using createMCPServer()
 * CLIENT-SIDE: Omit clientId and clientSecret when using createMCPClient()
 */
export interface GitHubPluginConfig {
  /** GitHub OAuth client ID (required on server, omit on client) */
  clientId?: string;
  /** GitHub OAuth client secret (required on server, omit on client) */
  clientSecret?: string;
  /** Additional OAuth scopes (default: ['repo', 'user']) */
  scopes?: string[];
  /** OAuth redirect URI */
  redirectUri?: string;
  /** GitHub API base URL (default: https://api.github.com) */
  apiBaseUrl?: string;
}

/**
 * Default GitHub tools that this plugin enables
 * These should match the tool names exposed by your MCP server
 */
const GITHUB_TOOLS = [
  "github_create_issue",
  "github_list_issues",
  "github_get_issue",
  "github_update_issue",
  "github_close_issue",
  "github_create_pull_request",
  "github_list_pull_requests",
  "github_get_pull_request",
  "github_merge_pull_request",
  "github_list_repos",
  "github_list_own_repos",
  "github_get_repo",
  "github_create_repo",
  "github_list_branches",
  "github_create_branch",
  "github_get_user",
  "github_list_commits",
  "github_get_commit",
] as const;

/**
 * GitHub Plugin
 * 
 * Enables GitHub integration with OAuth authentication
 * 
 * @example Server-side (with secrets):
 * ```typescript
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * 
 * export const { client } = createMCPServer({
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       scopes: ['repo', 'user', 'read:org'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Client-side (without secrets):
 * ```typescript
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   plugins: [
 *     githubPlugin({
 *       scopes: ['repo', 'user', 'read:org'],
 *     }),
 *   ],
 * });
 * ```
 */
export function githubPlugin(config: GitHubPluginConfig): MCPPlugin {
  const oauth: OAuthConfig = {
    provider: "github",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes || ["repo", "user"],
    redirectUri: config.redirectUri,
    config: {
      apiBaseUrl: config.apiBaseUrl || "https://api.github.com",
      ...config,
    },
  };

  return {
    id: "github",
    tools: [...GITHUB_TOOLS],
    oauth,
    
    async onInit(_client) {
      console.log("GitHub plugin initialized");
    },
    
    async onAfterConnect(_client) {
      console.log("GitHub plugin connected");
    },
  };
}

/**
 * Export tool names for type inference
 */
export type GitHubTools = typeof GITHUB_TOOLS[number];

/**
 * Export GitHub client types
 */
export type { GitHubPluginClient } from "./github-client.js";

