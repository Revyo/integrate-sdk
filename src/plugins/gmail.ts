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
  clientId: string;
  /** Google OAuth client secret */
  clientSecret: string;
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
  "gmail_send_email",
  "gmail_list_emails",
  "gmail_get_email",
  "gmail_delete_email",
  "gmail_search_emails",
  "gmail_mark_as_read",
  "gmail_mark_as_unread",
  "gmail_add_label",
  "gmail_remove_label",
  "gmail_list_labels",
  "gmail_create_label",
  "gmail_get_draft",
  "gmail_create_draft",
  "gmail_update_draft",
  "gmail_delete_draft",
  "gmail_send_draft",
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

