/**
 * Gmail Plugin
 * Enables Gmail tools with OAuth configuration
 */

import type { MCPPlugin, OAuthConfig } from "./types.js";

/**
 * Gmail plugin configuration
 * 
 * SERVER-SIDE: Automatically reads GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from environment.
 * You can override by providing explicit clientId and clientSecret values.
 * CLIENT-SIDE: Omit clientId and clientSecret when using createMCPClient()
 */
export interface GmailPluginConfig {
  /** Google OAuth client ID (defaults to GMAIL_CLIENT_ID env var) */
  clientId?: string;
  /** Google OAuth client secret (defaults to GMAIL_CLIENT_SECRET env var) */
  clientSecret?: string;
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
 * Enables Gmail integration with OAuth authentication.
 * 
 * By default, reads GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from environment variables.
 * You can override these by providing explicit values in the config.
 * 
 * @example Server-side (minimal - uses env vars):
 * ```typescript
 * import { createMCPServer, gmailPlugin } from 'integrate-sdk/server';
 * 
 * // Automatically uses GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from env
 * export const { client } = createMCPServer({
 *   plugins: [
 *     gmailPlugin({
 *       scopes: ['gmail.send', 'gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Server-side (with explicit override):
 * ```typescript
 * import { createMCPServer, gmailPlugin } from 'integrate-sdk/server';
 * 
 * export const { client } = createMCPServer({
 *   plugins: [
 *     gmailPlugin({
 *       clientId: process.env.CUSTOM_GMAIL_ID!,
 *       clientSecret: process.env.CUSTOM_GMAIL_SECRET!,
 *       scopes: ['gmail.send', 'gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Client-side (without secrets):
 * ```typescript
 * import { createMCPClient, gmailPlugin } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   plugins: [
 *     gmailPlugin({
 *       scopes: ['gmail.send', 'gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 */
export function gmailPlugin(config: GmailPluginConfig = {}): MCPPlugin {
  const oauth: OAuthConfig = {
    provider: "gmail",
    clientId: config.clientId ?? process.env.GMAIL_CLIENT_ID,
    clientSecret: config.clientSecret ?? process.env.GMAIL_CLIENT_SECRET,
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

