/**
 * Server Plugin Client Types
 * Fully typed interface for server-level tools that don't belong to a specific plugin
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * Server Plugin Client Interface
 * Provides type-safe methods for server-level operations
 */
export interface ServerPluginClient {
  /**
   * List all tools available for a specific integration
   */
  listToolsByIntegration(params: {
    integration: string;
  }): Promise<MCPToolCallResponse>;
}

