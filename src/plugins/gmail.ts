/**
 * Gmail Plugin
 * Enables Gmail tools with OAuth configuration
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * Gmail plugin configuration
 */
export interface GmailPluginConfig {
  /** Google OAuth client ID */
  clientId: string | undefined;
  /** Google OAuth client secret */
  clientSecret: string | undefined;
  /** Additional OAuth scopes (default: Gmail API scopes) */
  scopes?: string[];
  /** OAuth redirect URI */
  redirectUri?: string;
}

/**
 * Default Gmail tools that this plugin enables
 * These should match the tool names exposed by your MCP server
 */
const GMAIL_TOOLS = [
  "gmail_send_message",
  "gmail_list_messages",
  "gmail_get_message",
  "gmail_search_messages",
] as const;

/**
 * Gmail Plugin
 * 
 * Enables Gmail integration with OAuth authentication
 * 
 * @example
 * ```typescript
 * const client = createMCPClient({
 *   serverUrl: 'http://localhost:3000/mcp',
 *   plugins: [
 *     gmailPlugin({
 *       clientId: process.env.GMAIL_CLIENT_ID!,
 *       clientSecret: process.env.GMAIL_CLIENT_SECRET!,
 *     }),
 *   ],
 * });
 * ```
 */
export function gmailPlugin(config: GmailPluginConfig): MCPPlugin {
  const oauth: OAuthConfig = {
    provider: "google",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes || [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.labels",
    ],
    redirectUri: config.redirectUri,
    config,
  };

  return {
    id: "gmail",
    tools: [...GMAIL_TOOLS],
    oauth,
    
    async onInit(_client) {
      console.log("Gmail plugin initialized");
    },
    
    async onAfterConnect(_client) {
      console.log("Gmail plugin connected");
    },
  };
}

/**
 * Export tool names for type inference
 */
export type GmailTools = typeof GMAIL_TOOLS[number];

/**
 * Export Gmail client types
 */
export type { GmailPluginClient } from "./gmail-client.js";

