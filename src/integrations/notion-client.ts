/**
 * Notion Integration Client Types
 * Fully typed interface for Notion integration methods
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * Notion Page Object
 */
export interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon?: {
    type: "emoji" | "external" | "file";
    emoji?: string;
    external?: { url: string };
    file?: { url: string; expiry_time: string };
  };
  cover?: {
    type: "external" | "file";
    external?: { url: string };
    file?: { url: string; expiry_time: string };
  };
  properties: Record<string, any>;
  parent:
    | { type: "database_id"; database_id: string }
    | { type: "page_id"; page_id: string }
    | { type: "workspace"; workspace: true };
  url: string;
}

/**
 * Notion Database Object
 */
export interface NotionDatabase {
  id: string;
  created_time: string;
  last_edited_time: string;
  title: Array<{
    type: "text";
    text: { content: string; link?: { url: string } | null };
    annotations?: any;
    plain_text: string;
    href?: string | null;
  }>;
  description: Array<any>;
  icon?: {
    type: "emoji" | "external" | "file";
    emoji?: string;
    external?: { url: string };
    file?: { url: string; expiry_time: string };
  };
  cover?: {
    type: "external" | "file";
    external?: { url: string };
    file?: { url: string; expiry_time: string };
  };
  properties: Record<string, any>;
  parent:
    | { type: "database_id"; database_id: string }
    | { type: "page_id"; page_id: string }
    | { type: "workspace"; workspace: true };
  url: string;
  archived: boolean;
}

/**
 * Notion Search Result
 */
export interface NotionSearchResult {
  object: "page" | "database";
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  // Additional properties based on object type
  [key: string]: any;
}

/**
 * Notion Integration Client Interface
 * Provides type-safe methods for all Notion operations
 */
export interface NotionIntegrationClient {
  /**
   * Search for pages and databases in Notion
   * 
   * @example
   * ```typescript
   * const results = await client.notion.search({
   *   query: "Project Planning",
   *   filter: { property: "object", value: "page" },
   *   sort: { direction: "descending", timestamp: "last_edited_time" }
   * });
   * ```
   */
  search(params?: {
    /** Text query to search for */
    query?: string;
    /** Filter results by object type */
    filter?: {
      property: "object";
      value: "page" | "database";
    };
    /** Sort results */
    sort?: {
      direction: "ascending" | "descending";
      timestamp: "last_edited_time";
    };
    /** Page size for pagination (default: 100) */
    page_size?: number;
    /** Start cursor for pagination */
    start_cursor?: string;
  }): Promise<MCPToolCallResponse>;

  /**
   * Retrieve a Notion page by ID
   * 
   * @example
   * ```typescript
   * const page = await client.notion.getPage({
   *   page_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   * });
   * ```
   */
  getPage(params: {
    /** The ID of the page to retrieve */
    page_id: string;
    /** Filter the properties returned (optional) */
    filter_properties?: string[];
  }): Promise<MCPToolCallResponse>;
}

