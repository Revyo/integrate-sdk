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
import { OAuthManager } from "./oauth/manager.js";
import type {
  AuthStatus,
  OAuthCallbackParams,
  OAuthEventHandler,
  AuthStartedEvent,
  AuthCompleteEvent,
  AuthErrorEvent,
  AuthLogoutEvent,
  AuthDisconnectEvent,
} from "./oauth/types.js";

/**
 * Simple EventEmitter implementation for OAuth events
 */
class SimpleEventEmitter {
  private handlers: Map<string, Set<OAuthEventHandler>> = new Map();

  on(event: string, handler: OAuthEventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: OAuthEventHandler): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, payload: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

/**
 * MCP server URL
 */
const MCP_SERVER_URL = "https://mcp.integrate.dev/api/v1/mcp";

/**
 * Client instance cache for singleton pattern
 */
const clientCache = new Map<string, MCPClient<any>>();

/**
 * Set of clients to cleanup on exit
 */
const cleanupClients = new Set<MCPClient<any>>();

/**
 * Whether cleanup handlers have been registered
 */
let cleanupHandlersRegistered = false;

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
  private connectionMode: 'lazy' | 'eager' | 'manual';
  private connecting: Promise<void> | null = null;
  private oauthManager: OAuthManager;
  private eventEmitter: SimpleEventEmitter = new SimpleEventEmitter();

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

    // Determine OAuth API base and default redirect URI
    const oauthApiBase = config.oauthApiBase || '/api/integrate/oauth';
    const defaultRedirectUri = this.getDefaultRedirectUri(oauthApiBase);

    // Clone plugins and inject default redirectUri if not set
    this.plugins = config.plugins.map(plugin => {
      if (plugin.oauth && !plugin.oauth.redirectUri) {
        return {
          ...plugin,
          oauth: {
            ...plugin.oauth,
            redirectUri: defaultRedirectUri,
          },
        };
      }
      return plugin;
    }) as unknown as TPlugins;

    this.clientInfo = config.clientInfo || {
      name: "integrate-sdk",
      version: "0.1.0",
    };
    this.onReauthRequired = config.onReauthRequired;
    this.maxReauthRetries = config.maxReauthRetries ?? 1;
    this.connectionMode = config.connectionMode ?? 'lazy';

    // Initialize OAuth manager
    this.oauthManager = new OAuthManager(
      oauthApiBase,
      config.oauthFlow
    );

    // Load provider tokens from localStorage
    const providers = this.plugins
      .filter(p => p.oauth)
      .map(p => p.oauth!.provider);

    this.oauthManager.loadAllProviderTokens(providers);

    // Collect all enabled tool names from plugins
    for (const plugin of this.plugins) {
      for (const toolName of plugin.tools) {
        this.enabledToolNames.add(toolName);
      }

      // Initialize auth state for plugins with OAuth based on whether we have a token
      if (plugin.oauth) {
        const hasToken = this.oauthManager.getProviderToken(plugin.oauth.provider) !== undefined;
        this.authState.set(plugin.oauth.provider, { authenticated: hasToken });
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
   * Get default redirect URI for OAuth flows
   * Uses window.location.origin + OAuth API base path
   * 
   * @param oauthApiBase - The OAuth API base path (e.g., '/api/integrate/oauth')
   * @returns Default redirect URI
   */
  private getDefaultRedirectUri(oauthApiBase: string): string {
    // Only works in browser environment
    if (typeof window === 'undefined' || !window.location) {
      // Server-side fallback (shouldn't happen for client SDK)
      return 'http://localhost:3000/oauth/callback';
    }

    // Construct redirect URI from window.location.origin + OAuth API base path
    const origin = window.location.origin;
    // Normalize the API base path and append '/callback'
    const normalizedPath = oauthApiBase.replace(/\/$/, ''); // Remove trailing slash if present
    return `${origin}${normalizedPath}/callback`;
  }

  /**
   * Ensure the client is connected (for lazy connection mode)
   */
  private async ensureConnected(): Promise<void> {
    // If already connected, return immediately
    if (this.initialized && this.transport.isConnected()) {
      return;
    }

    // If already connecting, wait for it to complete
    if (this.connecting) {
      return this.connecting;
    }

    // If manual mode, throw error
    if (this.connectionMode === 'manual' && !this.initialized) {
      throw new Error("Client not connected. Call connect() first when using manual connection mode.");
    }

    // Start connection
    this.connecting = this.connect();

    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
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
          // Ensure connected before calling tool
          await this.ensureConnected();
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
          // Ensure connected before calling tool
          await this.ensureConnected();
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

    // Get provider for this tool and set Authorization header if it has OAuth
    const provider = this.getProviderForTool(name);
    if (provider) {
      const tokenData = this.oauthManager.getProviderToken(provider);
      if (tokenData) {
        // Set Authorization header with provider's access token
        this.transport.setHeader('Authorization', `Bearer ${tokenData.accessToken}`);
      }
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
   * Add event listener for OAuth events
   * 
   * @param event - Event type to listen for
   * @param handler - Handler function to call when event is emitted
   * 
   * @example
   * ```typescript
   * client.on('auth:complete', ({ provider, sessionToken }) => {
   *   console.log(`${provider} authorized!`);
   * });
   * 
   * client.on('auth:disconnect', ({ provider }) => {
   *   console.log(`${provider} disconnected`);
   * });
   * 
   * client.on('auth:logout', () => {
   *   console.log('User logged out from all services');
   * });
   * ```
   */
  on(event: 'auth:started', handler: OAuthEventHandler<AuthStartedEvent>): void;
  on(event: 'auth:complete', handler: OAuthEventHandler<AuthCompleteEvent>): void;
  on(event: 'auth:error', handler: OAuthEventHandler<AuthErrorEvent>): void;
  on(event: 'auth:disconnect', handler: OAuthEventHandler<AuthDisconnectEvent>): void;
  on(event: 'auth:logout', handler: OAuthEventHandler<AuthLogoutEvent>): void;
  on(event: string, handler: OAuthEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Remove event listener for OAuth events
   * 
   * @param event - Event type to stop listening for
   * @param handler - Handler function to remove
   */
  off(event: 'auth:started', handler: OAuthEventHandler<AuthStartedEvent>): void;
  off(event: 'auth:complete', handler: OAuthEventHandler<AuthCompleteEvent>): void;
  off(event: 'auth:error', handler: OAuthEventHandler<AuthErrorEvent>): void;
  off(event: 'auth:disconnect', handler: OAuthEventHandler<AuthDisconnectEvent>): void;
  off(event: 'auth:logout', handler: OAuthEventHandler<AuthLogoutEvent>): void;
  off(event: string, handler: OAuthEventHandler): void {
    this.eventEmitter.off(event, handler);
  }


  /**
   * Clear all provider tokens from localStorage
   */
  clearSessionToken(): void {
    this.oauthManager.clearAllProviderTokens();
  }

  /**
   * Disconnect a specific OAuth provider
   * Removes authorization for a single provider while keeping others connected
   * Makes a server-side call to revoke the provider's authorization
   * 
   * @param provider - Provider name to disconnect (e.g., 'github', 'gmail')
   * 
   * @example
   * ```typescript
   * // Disconnect only GitHub, keep Gmail connected
   * await client.disconnectProvider('github');
   * 
   * // Check if still authorized
   * const isAuthorized = await client.isAuthorized('github'); // false
   * 
   * // Re-authorize if needed
   * await client.authorize('github');
   * ```
   */
  async disconnectProvider(provider: string): Promise<void> {
    // Verify the provider exists in plugins
    const plugin = this.plugins.find(p => p.oauth?.provider === provider);

    if (!plugin?.oauth) {
      throw new Error(`No OAuth configuration found for provider: ${provider}`);
    }

    try {
      // Make server-side call to disconnect the provider
      await this.oauthManager.disconnectProvider(provider);

      // Reset authentication state for this provider only
      this.authState.set(provider, { authenticated: false });

      // Emit disconnect event for this provider
      this.eventEmitter.emit('auth:disconnect', { provider });
    } catch (error) {
      // Emit error event
      this.eventEmitter.emit('auth:error', {
        provider,
        error: error as Error
      });
      throw error;
    }

    // Note: We don't clear the session token since other providers may still be using it
    // The session on the server side will still exist for other providers
  }

  /**
   * Logout and terminate all OAuth connections
   * Clears all session tokens, pending OAuth state, and resets authentication state for all providers
   * 
   * @example
   * ```typescript
   * // Logout from all providers
   * await client.logout();
   * 
   * // User needs to authorize again for all providers
   * await client.authorize('github');
   * await client.authorize('gmail');
   * ```
   */
  async logout(): Promise<void> {
    // Clear session token from storage and manager
    this.clearSessionToken();

    // Clear all pending OAuth flows
    this.oauthManager.clearAllPendingAuths();

    // Reset authentication state for all providers
    this.authState.clear();

    // Re-initialize auth state as unauthenticated
    for (const plugin of this.plugins) {
      if (plugin.oauth) {
        this.authState.set(plugin.oauth.provider, { authenticated: false });
      }
    }

    // Emit logout event
    this.eventEmitter.emit('auth:logout', {});
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
   * Check if a provider is authorized via OAuth
   * Queries the MCP server to verify OAuth token validity
   * 
   * @param provider - Provider name (github, gmail, etc.)
   * @returns Authorization status
   * 
   * @example
   * ```typescript
   * const isAuthorized = await client.isAuthorized('github');
   * if (!isAuthorized) {
   *   await client.authorize('github');
   * }
   * ```
   */
  async isAuthorized(provider: string): Promise<boolean> {
    const status = await this.oauthManager.checkAuthStatus(provider);
    return status.authorized;
  }

  /**
   * Get list of all authorized providers
   * Checks all configured OAuth providers and returns names of authorized ones
   * 
   * @returns Array of authorized provider names
   * 
   * @example
   * ```typescript
   * const authorized = await client.authorizedProviders();
   * console.log('Authorized services:', authorized); // ['github', 'gmail']
   * 
   * // Check if specific service is in the list
   * if (authorized.includes('github')) {
   *   const repos = await client.github.listOwnRepos({});
   * }
   * ```
   */
  async authorizedProviders(): Promise<string[]> {
    const authorized: string[] = [];

    // Check each plugin with OAuth config
    for (const plugin of this.plugins) {
      if (plugin.oauth) {
        const status = await this.oauthManager.checkAuthStatus(plugin.oauth.provider);
        if (status.authorized) {
          authorized.push(plugin.oauth.provider);
        }
      }
    }

    return authorized;
  }

  /**
   * Get detailed authorization status for a provider
   * 
   * @param provider - Provider name
   * @returns Full authorization status including scopes and expiration
   */
  async getAuthorizationStatus(provider: string): Promise<AuthStatus> {
    return await this.oauthManager.checkAuthStatus(provider);
  }

  /**
   * Initiate OAuth authorization flow for a provider
   * Opens authorization URL in popup or redirects based on configuration
   * 
   * @param provider - Provider name (github, gmail, etc.)
   * @param options - Optional configuration for the authorization flow
   * @param options.returnUrl - URL to redirect to after OAuth completion (for redirect mode)
   * 
   * @example
   * ```typescript
   * // Basic usage - popup flow
   * await client.authorize('github');
   * 
   * // Redirect flow with custom return URL
   * await client.authorize('github', { 
   *   returnUrl: '/marketplace/github' 
   * });
   * 
   * // Auto-detect current location
   * await client.authorize('github', { 
   *   returnUrl: window.location.pathname 
   * });
   * ```
   */
  async authorize(provider: string, options?: { returnUrl?: string }): Promise<void> {
    const plugin = this.plugins.find(p => p.oauth?.provider === provider);

    if (!plugin?.oauth) {
      const error = new Error(`No OAuth configuration found for provider: ${provider}`);
      this.eventEmitter.emit('auth:error', { provider, error });
      throw error;
    }

    // Emit auth:started event
    this.eventEmitter.emit('auth:started', { provider });

    try {
      await this.oauthManager.initiateFlow(provider, plugin.oauth, options?.returnUrl);

      // Get the provider token after authorization
      const tokenData = this.oauthManager.getProviderToken(provider);

      if (tokenData) {
        // Emit auth:complete event
        this.eventEmitter.emit('auth:complete', {
          provider,
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt
        });
      }

      // Update auth state
      this.authState.set(provider, { authenticated: true });
    } catch (error) {
      this.eventEmitter.emit('auth:error', { provider, error: error as Error });
      throw error;
    }
  }

  /**
   * Handle OAuth callback after user authorization
   * Call this from your OAuth callback page with code and state from URL
   * 
   * @param params - Callback parameters containing code and state
   * 
   * @example
   * ```typescript
   * // In your callback route (e.g., /oauth/callback)
   * const params = new URLSearchParams(window.location.search);
   * await client.handleOAuthCallback({
   *   code: params.get('code')!,
   *   state: params.get('state')!
   * });
   * 
   * // Now you can use the client
   * const repos = await client.github.listOwnRepos({});
   * ```
   */
  async handleOAuthCallback(params: OAuthCallbackParams): Promise<void> {
    try {
      const result = await this.oauthManager.handleCallback(params.code, params.state);

      // Update auth state for this specific provider
      this.authState.set(result.provider, { authenticated: true });

      // Emit auth:complete event for the provider
      this.eventEmitter.emit('auth:complete', {
        provider: result.provider,
        accessToken: result.accessToken,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      // Emit error event (we don't know which provider, so use generic)
      this.eventEmitter.emit('auth:error', {
        provider: 'unknown',
        error: error as Error
      });
      throw error;
    }
  }

  /**
   * Get access token for a specific provider
   * Useful for making direct API calls or storing tokens
   * 
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @returns Provider token data or undefined if not authorized
   */
  getProviderToken(provider: string): import('./oauth/types.js').ProviderTokenData | undefined {
    return this.oauthManager.getProviderToken(provider);
  }

  /**
   * Set provider token manually
   * Use this if you have an existing provider token
   * 
   * @param provider - Provider name
   * @param tokenData - Provider token data
   */
  setProviderToken(provider: string, tokenData: import('./oauth/types.js').ProviderTokenData): void {
    this.oauthManager.setProviderToken(provider, tokenData);
    this.authState.set(provider, { authenticated: true });
  }

  /**
   * Get all provider tokens
   * Returns a map of provider names to access tokens
   * Useful for server-side usage where you need to pass tokens from client to server
   * 
   * @returns Record of provider names to access tokens
   * 
   * @example
   * ```typescript
   * // Client-side: Get all tokens to send to server
   * const tokens = client.getAllProviderTokens();
   * // { github: 'ghp_...', gmail: 'ya29...' }
   * 
   * // Send to server
   * await fetch('/api/ai', {
   *   method: 'POST',
   *   headers: {
   *     'x-integrate-tokens': JSON.stringify(tokens)
   *   },
   *   body: JSON.stringify({ prompt: 'Create a GitHub issue' })
   * });
   * ```
   */
  getAllProviderTokens(): Record<string, string> {
    const tokens: Record<string, string> = {};
    const allTokens = this.oauthManager.getAllProviderTokens();

    for (const [provider, tokenData] of allTokens.entries()) {
      tokens[provider] = tokenData.accessToken;
    }

    return tokens;
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
 * Register cleanup handlers for graceful shutdown
 */
function registerCleanupHandlers() {
  if (cleanupHandlersRegistered) return;
  cleanupHandlersRegistered = true;

  const cleanup = async () => {
    const clients = Array.from(cleanupClients);
    cleanupClients.clear();

    await Promise.all(
      clients.map(async (client) => {
        try {
          if (client.isConnected()) {
            await client.disconnect();
          }
        } catch (error) {
          console.error('Error disconnecting client:', error);
        }
      })
    );
  };

  if (typeof process !== 'undefined') {
    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });

    process.on('beforeExit', async () => {
      await cleanup();
    });
  }
}

/**
 * Generate a cache key for a client configuration
 */
function generateCacheKey<TPlugins extends readonly MCPPlugin[]>(
  config: MCPClientConfig<TPlugins>
): string {
  // Create a stable key based on configuration
  const parts = [
    config.clientInfo?.name || 'integrate-sdk',
    config.clientInfo?.version || '0.1.0',
    JSON.stringify(config.plugins.map(p => ({ id: p.id, tools: p.tools }))),
    JSON.stringify(config.headers || {}),
    config.timeout?.toString() || '30000',
  ];
  return parts.join('|');
}

/**
 * Create a new MCP Client instance
 * 
 * By default, uses singleton pattern and lazy connection:
 * - Returns cached instance if one exists with same configuration
 * - Automatically connects on first method call
 * - Automatically cleans up on process exit
 * 
 * @example
 * ```typescript
 * // Lazy connection (default) - connects automatically on first use
 * const client = createMCPClient({
 *   plugins: [
 *     githubPlugin({ clientId: '...', clientSecret: '...' }),
 *   ],
 * });
 * 
 * // No need to call connect()!
 * const repos = await client.github.listOwnRepos({});
 * 
 * // No need to call disconnect()! (auto-cleanup on exit)
 * ```
 * 
 * @example
 * ```typescript
 * // Manual connection mode (original behavior)
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ ... })],
 *   connectionMode: 'manual',
 *   singleton: false,
 * });
 * 
 * await client.connect();
 * const repos = await client.github.listOwnRepos({});
 * await client.disconnect();
 * ```
 */
export function createMCPClient<TPlugins extends readonly MCPPlugin[]>(
  config: MCPClientConfig<TPlugins>
): MCPClient<TPlugins> {
  const useSingleton = config.singleton ?? true;
  const connectionMode = config.connectionMode ?? 'lazy';
  const autoCleanup = config.autoCleanup ?? true;

  // Check cache for existing instance
  if (useSingleton) {
    const cacheKey = generateCacheKey(config);
    const existing = clientCache.get(cacheKey);

    if (existing && existing.isConnected()) {
      return existing as MCPClient<TPlugins>;
    }

    // Remove stale entry if exists
    if (existing) {
      clientCache.delete(cacheKey);
      cleanupClients.delete(existing);
    }

    // Create new instance
    const client = new MCPClient(config);
    clientCache.set(cacheKey, client);

    if (autoCleanup) {
      cleanupClients.add(client);
      registerCleanupHandlers();
    }

    // Eager connection if requested
    if (connectionMode === 'eager') {
      // Connect asynchronously, don't block
      client.connect().catch((error) => {
        console.error('Failed to connect client:', error);
      });
    }

    // Automatically handle OAuth callback if enabled
    if (config.autoHandleOAuthCallback !== false) {
      processOAuthCallbackFromHash(client);
    }

    return client;
  } else {
    // Non-singleton: create fresh instance
    const client = new MCPClient(config);

    if (autoCleanup) {
      cleanupClients.add(client);
      registerCleanupHandlers();
    }

    // Eager connection if requested
    if (connectionMode === 'eager') {
      client.connect().catch((error) => {
        console.error('Failed to connect client:', error);
      });
    }

    // Automatically handle OAuth callback if enabled
    if (config.autoHandleOAuthCallback !== false) {
      processOAuthCallbackFromHash(client);
    }

    return client;
  }
}

/**
 * Process OAuth callback from URL hash fragment
 * Automatically detects and processes #oauth_callback={...} in the URL
 */
function processOAuthCallbackFromHash(client: MCPClient<any>): void {
  // Only run in browser environment with proper window.location
  if (typeof window === 'undefined' || !window.location) {
    return;
  }

  try {
    const hash = window.location.hash;

    // Check if hash contains oauth_callback parameter
    if (hash && hash.includes('oauth_callback=')) {
      // Parse the hash
      const hashParams = new URLSearchParams(hash.substring(1));
      const oauthCallbackData = hashParams.get('oauth_callback');

      if (oauthCallbackData) {
        // Decode and parse the callback data
        const callbackParams = JSON.parse(decodeURIComponent(oauthCallbackData));

        // Validate that we have code and state
        if (callbackParams.code && callbackParams.state) {
          // Process the callback asynchronously
          client.handleOAuthCallback(callbackParams).catch((error) => {
            console.error('Failed to process OAuth callback:', error);
          });

          // Clean up URL hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }
  } catch (error) {
    console.error('Failed to process OAuth callback from hash:', error);
  }
}

/**
 * Clear the client cache and disconnect all cached clients
 * Useful for testing or when you need to force recreation of clients
 * 
 * @example
 * ```typescript
 * // In test teardown
 * afterAll(async () => {
 *   await clearClientCache();
 * });
 * ```
 */
export async function clearClientCache(): Promise<void> {
  const clients = Array.from(clientCache.values());
  clientCache.clear();

  await Promise.all(
    clients.map(async (client) => {
      try {
        if (client.isConnected()) {
          await client.disconnect();
        }
      } catch (error) {
        console.error('Error disconnecting client during cache clear:', error);
      }
    })
  );
}

