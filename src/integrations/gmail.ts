/**
 * Gmail Integration
 * Enables Gmail tools with OAuth configuration
 */

import type { MCPIntegration, OAuthConfig } from "./types.js";
import { getEnv } from "../utils/env.js";

/**
 * Gmail integration configuration
 * 
 * SERVER-SIDE: Automatically reads GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from environment.
 * You can override by providing explicit clientId and clientSecret values.
 * CLIENT-SIDE: Omit clientId and clientSecret when using createMCPClient()
 */
export interface GmailIntegrationConfig {
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
 * Default Gmail tools that this integration enables
 * These should match the tool names exposed by your MCP server
 */
const GMAIL_TOOLS = [
  "gmail_send_message",
  "gmail_list_messages",
  "gmail_get_message",
  "gmail_search_messages",
] as const;

/**
 * Gmail Integration
 * 
 * Enables Gmail integration with OAuth authentication.
 * 
 * By default, reads GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from environment variables.
 * You can override these by providing explicit values in the config.
 * 
 * @example Server-side (minimal - uses env vars):
 * ```typescript
 * import { createMCPServer, gmailIntegration } from 'integrate-sdk/server';
 * 
 * // Automatically uses GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from env
 * export const { client } = createMCPServer({
 *   integrations: [
 *     gmailIntegration({
 *       scopes: ['gmail.send', 'gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Server-side (with explicit override):
 * ```typescript
 * import { createMCPServer, gmailIntegration } from 'integrate-sdk/server';
 * 
 * export const { client } = createMCPServer({
 *   integrations: [
 *     gmailIntegration({
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
 * import { createMCPClient, gmailIntegration } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   integrations: [
 *     gmailIntegration({
 *       scopes: ['gmail.send', 'gmail.readonly'],
 *     }),
 *   ],
 * });
 * ```
 */
export function gmailIntegration(config: GmailIntegrationConfig = {}): MCPIntegration<"gmail"> {
  const oauth: OAuthConfig = {
    provider: "gmail",
    clientId: config.clientId ?? getEnv('GMAIL_CLIENT_ID'),
    clientSecret: config.clientSecret ?? getEnv('GMAIL_CLIENT_SECRET'),
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
      console.log("Gmail integration initialized");
    },

    async onAfterConnect(_client) {
      console.log("Gmail integration connected");
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
export type { GmailIntegrationClient } from "./gmail-client.js";

