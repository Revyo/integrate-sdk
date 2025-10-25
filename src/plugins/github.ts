/**
 * GitHub Plugin
 * Enables GitHub tools with OAuth configuration
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * GitHub plugin configuration
 */
export interface GitHubPluginConfig {
  /** GitHub OAuth client ID */
  clientId: string;
  /** GitHub OAuth client secret */
  clientSecret: string;
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
  "github/createIssue",
  "github/listIssues",
  "github/getIssue",
  "github/updateIssue",
  "github/closeIssue",
  "github/createPullRequest",
  "github/listPullRequests",
  "github/getPullRequest",
  "github/mergePullRequest",
  "github/listRepositories",
  "github/getRepository",
  "github/createRepository",
  "github/listBranches",
  "github/createBranch",
  "github/getUser",
  "github/listCommits",
  "github/getCommit",
] as const;

/**
 * GitHub Plugin
 * 
 * Enables GitHub integration with OAuth authentication
 * 
 * @example
 * ```typescript
 * const client = createMCPClient({
 *   serverUrl: 'http://localhost:3000/mcp',
 *   plugins: [
 *     githubPlugin({
 *       clientId: process.env.GITHUB_CLIENT_ID!,
 *       clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *       scopes: ['repo', 'user', 'read:org'],
 *     }),
 *   ],
 * });
 * ```
 */
export function githubPlugin(config: GitHubPluginConfig): MCPPlugin<GitHubPluginConfig> {
  const oauth: OAuthConfig<GitHubPluginConfig> = {
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

