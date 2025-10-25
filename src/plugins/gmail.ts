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
  "gmail/sendEmail",
  "gmail/listEmails",
  "gmail/getEmail",
  "gmail/deleteEmail",
  "gmail/searchEmails",
  "gmail/markAsRead",
  "gmail/markAsUnread",
  "gmail/addLabel",
  "gmail/removeLabel",
  "gmail/listLabels",
  "gmail/createLabel",
  "gmail/getDraft",
  "gmail/createDraft",
  "gmail/updateDraft",
  "gmail/deleteDraft",
  "gmail/sendDraft",
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
export function gmailPlugin(config: GmailPluginConfig): MCPPlugin<GmailPluginConfig> {
  const oauth: OAuthConfig<GmailPluginConfig> = {
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

