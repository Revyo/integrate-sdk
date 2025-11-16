/**
 * Server Integration Client Types
 * Fully typed interface for server-level tools that don't belong to a specific integration
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * Server Integration Client Interface
 * Provides type-safe methods for server-level operations
 */
export interface ServerIntegrationClient {
  /**
   * List all tools available for a specific integration
   */
  listToolsByIntegration(params: {
    integration: string;
  }): Promise<MCPToolCallResponse>;
}

