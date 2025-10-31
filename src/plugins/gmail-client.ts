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
   * Send an email
   */
  sendEmail(params: {
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
   * List emails in the mailbox
   */
  listEmails(params?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    labelIds?: string[];
    includeSpamTrash?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a specific email by ID
   */
  getEmail(params: {
    id: string;
    format?: "minimal" | "full" | "raw" | "metadata";
  }): Promise<MCPToolCallResponse>;

  /**
   * Delete an email
   */
  deleteEmail(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Search emails with query
   */
  searchEmails(params: {
    query: string;
    maxResults?: number;
    pageToken?: string;
    includeSpamTrash?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * Mark an email as read
   */
  markAsRead(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Mark an email as unread
   */
  markAsUnread(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Add label(s) to an email
   */
  addLabel(params: {
    id: string;
    labelIds: string[];
  }): Promise<MCPToolCallResponse>;

  /**
   * Remove label(s) from an email
   */
  removeLabel(params: {
    id: string;
    labelIds: string[];
  }): Promise<MCPToolCallResponse>;

  /**
   * List all labels
   */
  listLabels(params?: {
    userId?: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Create a new label
   */
  createLabel(params: {
    name: string;
    labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
    messageListVisibility?: "show" | "hide";
    backgroundColor?: string;
    textColor?: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Get a draft by ID
   */
  getDraft(params: {
    id: string;
    format?: "minimal" | "full" | "raw" | "metadata";
  }): Promise<MCPToolCallResponse>;

  /**
   * Create a new draft
   */
  createDraft(params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    from?: string;
    replyTo?: string;
    html?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * Update an existing draft
   */
  updateDraft(params: {
    id: string;
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    from?: string;
    replyTo?: string;
    html?: boolean;
  }): Promise<MCPToolCallResponse>;

  /**
   * Delete a draft
   */
  deleteDraft(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Send a draft
   */
  sendDraft(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;
}

