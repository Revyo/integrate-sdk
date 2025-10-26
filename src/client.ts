/**
 * MCP Client
 * Main client class that orchestrates transport, protocol, and plugins
 */

import { HttpSessionTransport } from "./transport/http-session.js";
import type {
  MCPTool,
  MCPToolsListResponse,
  MCPToolCallResponse,
  MCPInitializeParams,
  MCPInitializeResponse,
  MCPToolCallParams,
} from "./protocol/messages.js";
import { MCPMethod } from "./protocol/messages.js";
import type { MCPPlugin, OAuthConfig } from "./plugins/types.js";
import type { MCPClientConfig } from "./config/types.js";

/**
 * MCP server URL
 */
const MCP_SERVER_URL = "https://mcp.integrate.dev/api/v1/mcp";

/**
 * Tool invocation options
 */
export interface ToolInvocationOptions {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments?: Record<string, unknown>;
}

/**
 * MCP Client Class
 * 
 * Provides type-safe access to MCP server tools with plugin-based configuration
 */
export class MCPClient<TPlugins extends readonly MCPPlugin[] = readonly MCPPlugin[]> {
  private transport: HttpSessionTransport;
  private plugins: TPlugins;
  private availableTools: Map<string, MCPTool> = new Map();
  private enabledToolNames: Set<string> = new Set();
  private initialized = false;
  private clientInfo: { name: string; version: string };

  constructor(config: MCPClientConfig<TPlugins>) {
    this.transport = new HttpSessionTransport({
      url: MCP_SERVER_URL,
      headers: config.headers,
      timeout: config.timeout,
    });

    this.plugins = config.plugins;
    this.clientInfo = config.clientInfo || {
      name: "integrate-sdk",
      version: "0.1.0",
    };

    // Collect all enabled tool names from plugins
    for (const plugin of this.plugins) {
      for (const toolName of plugin.tools) {
        this.enabledToolNames.add(toolName);
      }
    }

    // Initialize plugins
    this.initializePlugins();
  }

  /**
   * Initialize all plugins
   */
  private async initializePlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onInit) {
        await plugin.onInit(this);
      }
    }
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    // Call onBeforeConnect hooks
    for (const plugin of this.plugins) {
      if (plugin.onBeforeConnect) {
        await plugin.onBeforeConnect(this);
      }
    }

    // Connect transport
    await this.transport.connect();

    // Initialize protocol
    await this.initialize();

    // Discover available tools
    await this.discoverTools();

    // Call onAfterConnect hooks
    for (const plugin of this.plugins) {
      if (plugin.onAfterConnect) {
        await plugin.onAfterConnect(this);
      }
    }
  }

  /**
   * Initialize the MCP protocol
   */
  private async initialize(): Promise<MCPInitializeResponse> {
    const params: MCPInitializeParams = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      clientInfo: this.clientInfo,
    };

    const response = await this.transport.sendRequest<MCPInitializeResponse>(
      MCPMethod.INITIALIZE,
      params
    );

    this.initialized = true;
    return response;
  }

  /**
   * Discover available tools from the server
   */
  private async discoverTools(): Promise<void> {
    const response = await this.transport.sendRequest<MCPToolsListResponse>(
      MCPMethod.TOOLS_LIST
    );

    // Store all available tools
    for (const tool of response.tools) {
      this.availableTools.set(tool.name, tool);
    }

    // Filter to only enabled tools
    const enabledTools = response.tools.filter((tool) =>
      this.enabledToolNames.has(tool.name)
    );

    console.log(
      `Discovered ${response.tools.length} tools, ${enabledTools.length} enabled by plugins`
    );
  }

  /**
   * Call a tool by name
   */
  async callTool(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse> {
    if (!this.initialized) {
      throw new Error("Client not initialized. Call connect() first.");
    }

    if (!this.enabledToolNames.has(name)) {
      throw new Error(
        `Tool "${name}" is not enabled. Enable it by adding the appropriate plugin.`
      );
    }

    if (!this.availableTools.has(name)) {
      throw new Error(
        `Tool "${name}" is not available on the server. Available tools: ${Array.from(
          this.availableTools.keys()
        ).join(", ")}`
      );
    }

    const params: MCPToolCallParams = {
      name,
      arguments: args,
    };

    return await this.transport.sendRequest<MCPToolCallResponse>(
      MCPMethod.TOOLS_CALL,
      params
    );
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.availableTools.get(name);
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.availableTools.values());
  }

  /**
   * Get all enabled tools (filtered by plugins)
   */
  getEnabledTools(): MCPTool[] {
    return Array.from(this.availableTools.values()).filter((tool) =>
      this.enabledToolNames.has(tool.name)
    );
  }

  /**
   * Get OAuth configuration for a plugin
   */
  getOAuthConfig(pluginId: string): OAuthConfig | undefined {
    const plugin = this.plugins.find((p) => p.id === pluginId);
    return plugin?.oauth;
  }

  /**
   * Get all OAuth configurations
   */
  getAllOAuthConfigs(): Map<string, OAuthConfig> {
    const configs = new Map<string, OAuthConfig>();
    for (const plugin of this.plugins) {
      if (plugin.oauth) {
        configs.set(plugin.id, plugin.oauth);
      }
    }
    return configs;
  }

  /**
   * Register a message handler
   */
  onMessage(
    handler: (message: unknown) => void
  ): () => void {
    return this.transport.onMessage(handler);
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    // Call onDisconnect hooks
    for (const plugin of this.plugins) {
      if (plugin.onDisconnect) {
        await plugin.onDisconnect(this);
      }
    }

    await this.transport.disconnect();
    this.initialized = false;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.transport.isConnected();
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a new MCP Client instance
 * 
 * Connects to the Integrate MCP server at https://mcp.integrate.dev/api/v1/mcp
 * 
 * @example
 * ```typescript
 * const client = createMCPClient({
 *   plugins: [
 *     githubPlugin({ clientId: '...', clientSecret: '...' }),
 *     gmailPlugin({ clientId: '...', clientSecret: '...' }),
 *   ],
 * });
 * 
 * await client.connect();
 * const result = await client.callTool('github_create_issue', {
 *   repo: 'owner/repo',
 *   title: 'Bug report',
 * });
 * ```
 */
export function createMCPClient<TPlugins extends readonly MCPPlugin[]>(
  config: MCPClientConfig<TPlugins>
): MCPClient<TPlugins> {
  return new MCPClient(config);
}

