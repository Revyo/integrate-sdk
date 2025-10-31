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
import type { MCPClientConfig, ReauthHandler } from "./config/types.js";
import {
  parseServerError,
  isAuthError,
  type AuthenticationError,
} from "./errors.js";
import { methodToToolName } from "./utils/naming.js";
import type { GitHubPluginClient } from "./plugins/github-client.js";
import type { GmailPluginClient } from "./plugins/gmail-client.js";
import type { ServerPluginClient } from "./plugins/server-client.js";

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
 * Extract all plugin IDs from a plugins array as a union
 */
type ExtractPluginId<T> = T extends { id: infer Id } ? Id : never;
type PluginIds<TPlugins extends readonly MCPPlugin[]> = ExtractPluginId<TPlugins[number]>;

/**
 * Check if a specific plugin ID exists in the plugin array
 */
type HasPluginId<TPlugins extends readonly MCPPlugin[], Id extends string> = 
  Id extends PluginIds<TPlugins> ? true : false;

/**
 * Plugin namespace type mapping - only includes properties for configured plugins
 */
type PluginNamespaces<TPlugins extends readonly MCPPlugin[]> = 
  (HasPluginId<TPlugins, "github"> extends true ? { github: GitHubPluginClient } : {}) &
  (HasPluginId<TPlugins, "gmail"> extends true ? { gmail: GmailPluginClient } : {});

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
  private onReauthRequired?: ReauthHandler;
  private maxReauthRetries: number;
  private authState: Map<string, { authenticated: boolean; lastError?: AuthenticationError }> = new Map();

  // Plugin namespaces - dynamically typed based on configured plugins
  public readonly github!: PluginNamespaces<TPlugins> extends { github: GitHubPluginClient } 
    ? GitHubPluginClient 
    : never;
  public readonly gmail!: PluginNamespaces<TPlugins> extends { gmail: GmailPluginClient } 
    ? GmailPluginClient 
    : never;
  
  // Server namespace - always available for server-level tools
  public readonly server!: ServerPluginClient;

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
    this.onReauthRequired = config.onReauthRequired;
    this.maxReauthRetries = config.maxReauthRetries ?? 1;

    // Collect all enabled tool names from plugins
    for (const plugin of this.plugins) {
      for (const toolName of plugin.tools) {
        this.enabledToolNames.add(toolName);
      }
      
      // Initialize auth state for plugins with OAuth
      if (plugin.oauth) {
        this.authState.set(plugin.oauth.provider, { authenticated: true });
      }
    }

    // Initialize plugin namespaces with proxies
    this.github = this.createPluginProxy("github") as any;
    this.gmail = this.createPluginProxy("gmail") as any;
    this.server = this.createServerProxy() as any;

    // Initialize plugins
    this.initializePlugins();
  }

  /**
   * Create a proxy for a plugin namespace that intercepts method calls
   * and routes them to the appropriate tool
   */
  private createPluginProxy(pluginId: string): any {
    return new Proxy({}, {
      get: (_target, methodName: string) => {
        // Return a function that calls the tool
        return async (args?: Record<string, unknown>) => {
          const toolName = methodToToolName(methodName, pluginId);
          return await this.callToolWithRetry(toolName, args, 0);
        };
      },
    });
  }

  /**
   * Create a proxy for the server namespace that handles server-level tools
   */
  private createServerProxy(): any {
    return new Proxy({}, {
      get: (_target, methodName: string) => {
        // Return a function that calls the server tool directly
        return async (args?: Record<string, unknown>) => {
          const toolName = methodToToolName(methodName, "");
          // Remove leading underscore if present
          const finalToolName = toolName.startsWith("_") ? toolName.substring(1) : toolName;
          return await this.callServerToolInternal(finalToolName, args);
        };
      },
    });
  }

  /**
   * Internal implementation for calling server tools
   */
  private async callServerToolInternal(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse> {
    if (!this.initialized) {
      throw new Error("Client not initialized. Call connect() first.");
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

    try {
      const response = await this.transport.sendRequest<MCPToolCallResponse>(
        MCPMethod.TOOLS_CALL,
        params
      );
      
      return response;
    } catch (error) {
      // For server tools, we don't have provider info, so just parse the error
      const parsedError = parseServerError(error, { toolName: name });
      throw parsedError;
    }
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
   * Internal method for integrations to call tools by name
   * Used by integrations like Vercel AI that need to map from tool names
   * @internal
   */
  async _callToolByName(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse> {
    return await this.callToolWithRetry(name, args, 0);
  }

  /**
   * Call any available tool on the server by name, bypassing plugin restrictions
   * Useful for server-level tools like 'list_tools_by_integration' that don't belong to a specific plugin
   * 
   * @example
   * ```typescript
   * // Call a server-level tool
   * const tools = await client.callServerTool('list_tools_by_integration', { 
   *   integration: 'github' 
   * });
   * ```
   */
  async callServerTool(
    name: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse> {
    if (!this.initialized) {
      throw new Error("Client not initialized. Call connect() first.");
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

    try {
      const response = await this.transport.sendRequest<MCPToolCallResponse>(
        MCPMethod.TOOLS_CALL,
        params
      );
      
      return response;
    } catch (error) {
      // For server tools, we don't have provider info, so just parse the error
      const parsedError = parseServerError(error, { toolName: name });
      throw parsedError;
    }
  }

  /**
   * Internal method to call a tool with retry logic
   */
  private async callToolWithRetry(
    name: string,
    args?: Record<string, unknown>,
    retryCount = 0
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

    try {
      const response = await this.transport.sendRequest<MCPToolCallResponse>(
        MCPMethod.TOOLS_CALL,
        params
      );
      
      // Mark provider as authenticated on success
      const provider = this.getProviderForTool(name);
      if (provider) {
        this.authState.set(provider, { authenticated: true });
      }
      
      return response;
    } catch (error) {
      // Parse the error to determine if it's an auth error
      const provider = this.getProviderForTool(name);
      const parsedError = parseServerError(error, { toolName: name, provider });

      // Handle authentication errors with retry logic
      if (isAuthError(parsedError) && retryCount < this.maxReauthRetries) {
        // Update auth state
        if (provider) {
          this.authState.set(provider, {
            authenticated: false,
            lastError: parsedError,
          });
        }

        // Trigger re-authentication if handler is provided
        if (this.onReauthRequired && provider) {
          const reauthSuccess = await this.onReauthRequired({
            provider,
            error: parsedError,
            toolName: name,
          });

          if (reauthSuccess) {
            // Retry the tool call after successful re-authentication
            return await this.callToolWithRetry(name, args, retryCount + 1);
          }
        }
      }

      // If no handler or re-auth failed, throw the parsed error
      throw parsedError;
    }
  }

  /**
   * Get the OAuth provider for a given tool
   */
  private getProviderForTool(toolName: string): string | undefined {
    for (const plugin of this.plugins) {
      if (plugin.tools.includes(toolName) && plugin.oauth) {
        return plugin.oauth.provider;
      }
    }
    return undefined;
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

  /**
   * Get authentication state for a specific provider
   */
  getAuthState(provider: string): { authenticated: boolean; lastError?: AuthenticationError } | undefined {
    return this.authState.get(provider);
  }

  /**
   * Check if a specific provider is authenticated
   */
  isProviderAuthenticated(provider: string): boolean {
    return this.authState.get(provider)?.authenticated ?? false;
  }

  /**
   * Manually trigger re-authentication for a specific provider
   * Useful if you want to proactively refresh tokens
   */
  async reauthenticate(provider: string): Promise<boolean> {
    const state = this.authState.get(provider);
    if (!state) {
      throw new Error(`Provider "${provider}" not found in configured plugins`);
    }

    if (!this.onReauthRequired) {
      throw new Error("No re-authentication handler configured. Set onReauthRequired in client config.");
    }

    const lastError = state.lastError || new (await import("./errors.js")).AuthenticationError(
      "Manual re-authentication requested",
      undefined,
      provider
    );

    const success = await this.onReauthRequired({
      provider,
      error: lastError,
    });

    if (success) {
      this.authState.set(provider, { authenticated: true });
    }

    return success;
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

