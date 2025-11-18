/**
 * Notion Integration
 * Enables Notion tools with OAuth configuration
 */

import type { MCPIntegration, OAuthConfig } from "./types.js";
import { getEnv } from "../utils/env.js";

/**
 * Notion integration configuration
 * 
 * SERVER-SIDE: Automatically reads NOTION_CLIENT_ID and NOTION_CLIENT_SECRET from environment.
 * You can override by providing explicit clientId and clientSecret values.
 * CLIENT-SIDE: Omit clientId and clientSecret when using createMCPClient()
 */
export interface NotionIntegrationConfig {
  /** Notion OAuth client ID (defaults to NOTION_CLIENT_ID env var) */
  clientId?: string;
  /** Notion OAuth client secret (defaults to NOTION_CLIENT_SECRET env var) */
  clientSecret?: string;
  /** OAuth redirect URI (optional - auto-detected from environment) */
  redirectUri?: string;
  /** 
   * Notion OAuth owner parameter
   * - 'user': Integration will be added to the user's workspace (default)
   * - 'workspace': Integration will be added at workspace level
   */
  owner?: 'user' | 'workspace';
}

/**
 * Default Notion tools that this integration enables
 * These should match the tool names exposed by your MCP server
 */
const NOTION_TOOLS = [
  "notion_search",
  "notion_get_page",
] as const;

/**
 * Notion Integration
 * 
 * Enables Notion integration with OAuth authentication.
 * 
 * By default, reads NOTION_CLIENT_ID and NOTION_CLIENT_SECRET from environment variables.
 * You can override these by providing explicit values in the config.
 * 
 * Note: Notion's OAuth has special requirements:
 * - Uses a custom authorization endpoint (https://api.notion.com/v1/oauth/authorize)
 * - Requires an 'owner' parameter ('user' or 'workspace')
 * - Does not use traditional OAuth scopes
 * 
 * @example Server-side (minimal - uses env vars):
 * ```typescript
 * import { createMCPServer, notionIntegration } from 'integrate-sdk/server';
 * 
 * // Automatically uses NOTION_CLIENT_ID and NOTION_CLIENT_SECRET from env
 * export const { client } = createMCPServer({
 *   integrations: [
 *     notionIntegration(),
 *   ],
 * });
 * ```
 * 
 * @example Server-side (with explicit override):
 * ```typescript
 * import { createMCPServer, notionIntegration } from 'integrate-sdk/server';
 * 
 * export const { client } = createMCPServer({
 *   integrations: [
 *     notionIntegration({
 *       clientId: process.env.NOTION_CLIENT_ID!,
 *       clientSecret: process.env.NOTION_CLIENT_SECRET!,
 *       owner: 'workspace', // or 'user' (default)
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Client-side (without secrets):
 * ```typescript
 * import { createMCPClient, notionIntegration } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   integrations: [
 *     notionIntegration(),
 *   ],
 * });
 * ```
 */
export function notionIntegration(config: NotionIntegrationConfig = {}): MCPIntegration<"notion"> {
  const oauth: OAuthConfig = {
    provider: "notion",
    clientId: config.clientId ?? getEnv('NOTION_CLIENT_ID'),
    clientSecret: config.clientSecret ?? getEnv('NOTION_CLIENT_SECRET'),
    scopes: [], // Notion doesn't use traditional OAuth scopes
    redirectUri: config.redirectUri,
    config: {
      owner: config.owner || 'user',
      authorization_endpoint: 'https://api.notion.com/v1/oauth/authorize',
      token_endpoint: 'https://api.notion.com/v1/oauth/token',
      ...config,
    },
  };

  return {
    id: "notion",
    tools: [...NOTION_TOOLS],
    oauth,

    async onInit(_client) {
      console.log("Notion integration initialized");
    },

    async onAfterConnect(_client) {
      console.log("Notion integration connected");
    },
  };
}

/**
 * Export tool names for type inference
 */
export type NotionTools = typeof NOTION_TOOLS[number];

/**
 * Export Notion client types
 */
export type { NotionIntegrationClient } from "./notion-client.js";

