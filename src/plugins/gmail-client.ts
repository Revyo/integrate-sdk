/**
 * Gmail Plugin Client Types
 * Fully typed interface for Gmail plugin methods
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * Gmail Email Message
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
    body?: {
      data?: string;
      size?: number;
    };
    parts?: Array<{
      mimeType?: string;
      body?: {
        data?: string;
        size?: number;
      };
    }>;
  };
  sizeEstimate?: number;
  historyId?: string;
  internalDate?: string;
}

/**
 * Gmail Label
 */
export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

/**
 * Gmail Draft
 */
export interface GmailDraft {
  id: string;
  message: GmailMessage;
}

/**
 * Gmail Plugin Client Interface
 * Provides type-safe methods for all Gmail operations
 */
export interface GmailPluginClient {
  /**
   * Send a message
   */
  sendMessage(params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    from?: string;
    replyTo?: string;
    html?: boolean;
    attachments?: Array<{
      filename: string;
      content: string;
      encoding?: string;
    }>;
  }): Promise<MCPToolCallResponse>;

  /**
   * List messages in the mailbox
   */
  listMessages(params?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
    includeSpamTrash?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific message by ID
   */
  getMessage(params: {
    id: string;
    format?: "minimal" | "full" | "raw" | "metadata";
  }): Promise<MCPToolCallResponse>;

  /**
   * Search messages with query
   */
  searchMessages(params: {
    query: string;
    maxResults?: number;
    pageToken?: string;
    includeSpamTrash?: boolean;
  }): Promise<MCPToolCallResponse>;
}

