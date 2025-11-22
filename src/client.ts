/**
 * MCP Client
 * Main client class that orchestrates transport, protocol, and integrations
 */

import { HttpSessionTransport } from "./transport/http-session.js";
import type {
  MCPTool,
  MCPToolsListResponse,
  MCPToolCallResponse,
  MCPInitializeParams,
  MCPInitializeResponse,
} from "./protocol/messages.js";
import { MCPMethod } from "./protocol/messages.js";
import type { MCPIntegration, OAuthConfig } from "./integrations/types.js";
import type { MCPClientConfig, ReauthHandler, ToolCallOptions, MCPContext } from "./config/types.js";
import {
  parseServerError,
  isAuthError,
  type AuthenticationError,
} from "./errors.js";
import { methodToToolName } from "./utils/naming.js";
import type { GitHubIntegrationClient } from "./integrations/github-client.js";
import type { GmailIntegrationClient } from "./integrations/gmail-client.js";
import type { NotionIntegrationClient } from "./integrations/notion-client.js";
import type { ServerIntegrationClient } from "./integrations/server-client.js";
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
const clientCache = new Map<string, MCPClientBase<any>>();

/**
 * Set of clients to cleanup on exit
 */
const cleanupClients = new Set<MCPClientBase<any>>();

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
 * Extract all integration IDs from a integrations array as a union
 */
type ExtractIntegrationId<T> = T extends { id: infer Id } ? Id : never;
type IntegrationIds<TIntegrations extends readonly MCPIntegration[]> = ExtractIntegrationId<TIntegrations[number]>;

/**
 * Integration namespace type mapping - only includes properties for configured integrations
 * Uses a single mapped type to avoid intersection issues with IDE autocomplete
 */
type IntegrationNamespaces<TIntegrations extends readonly MCPIntegration[]> = {
  [K in IntegrationIds<TIntegrations> as K extends "github" 
    ? "github" 
    : K extends "gmail" 
    ? "gmail"
    : K extends "notion"
    ? "notion"
    : never]: 
      K extends "github" ? GitHubIntegrationClient :
      K extends "gmail" ? GmailIntegrationClient :
      K extends "notion" ? NotionIntegrationClient :
      never;
};

/**
 * MCP Client Class
 * 
 * Provides type-safe access to MCP server tools with integration-based configuration.
 * Integration namespaces (github, gmail, etc.) are only available when configured.
 */
export type MCPClient<TIntegrations extends readonly MCPIntegration[] = readonly MCPIntegration[]> = 
  MCPClientBase<TIntegrations> & IntegrationNamespaces<TIntegrations>;

/**
 * Base MCP Client Class (without integration namespaces)
 * Integration namespaces are added dynamically at runtime and via type intersection
 * @internal
 */
export class MCPClientBase<TIntegrations extends readonly MCPIntegration[] = readonly MCPIntegration[]> {
  private transport: HttpSessionTransport;
  private integrations: TIntegrations;
  private availableTools: Map<string, MCPTool> = new Map();
  private enabledToolNames: Set<string> = new Set();
  private initialized = false;
  private clientInfo: { name: string; version: string };
  private onReauthRequired?: ReauthHandler;
  private maxReauthRetries: number;
  private authState: Map<string, { authenticated: boolean; lastError?: AuthenticationError }> = new Map();
  private oauthManager: OAuthManager;
  private eventEmitter: SimpleEventEmitter = new SimpleEventEmitter();
  private apiRouteBase: string;
  private apiBaseUrl?: string;
  
  /**
   * Promise that resolves when OAuth callback processing is complete
   * @internal Used by createMCPClient to store callback promise
   */
  oauthCallbackPromise?: Promise<void> | null;

  // Server namespace - always available for server-level tools
  public readonly server!: ServerIntegrationClient;

  constructor(config: MCPClientConfig<TIntegrations>) {
    this.transport = new HttpSessionTransport({
      url: config.serverUrl || MCP_SERVER_URL,
      headers: config.headers,
      timeout: config.timeout,
    });

    // Note: API key is only set server-side via createMCPServer()
    // Client-side instances should never have access to the API key

    // Determine OAuth API base and default redirect URI
    const oauthApiBase = config.oauthApiBase || '/api/integrate/oauth';
    const defaultRedirectUri = this.getDefaultRedirectUri(oauthApiBase);

    // Determine API route base for tool calls
    this.apiRouteBase = config.apiRouteBase || '/api/integrate';
    
    // Store apiBaseUrl for cross-origin API calls (optional)
    this.apiBaseUrl = config.apiBaseUrl;

    // Clone integrations and inject default redirectUri if not set
    this.integrations = config.integrations.map(integration => {
      if (integration.oauth && !integration.oauth.redirectUri) {
        return {
          ...integration,
          oauth: {
            ...integration.oauth,
            redirectUri: defaultRedirectUri,
          },
        };
      }
      return integration;
    }) as unknown as TIntegrations;

    this.clientInfo = config.clientInfo || {
      name: "integrate-sdk",
      version: "0.1.0",
    };
    this.onReauthRequired = config.onReauthRequired;
    this.maxReauthRetries = config.maxReauthRetries ?? 1;

    // Initialize OAuth manager with token callbacks (server-side only)
    this.oauthManager = new OAuthManager(
      oauthApiBase,
      config.oauthFlow,
      this.apiBaseUrl,
      {
        getProviderToken: (config as any).getProviderToken,
        setProviderToken: (config as any).setProviderToken,
        removeProviderToken: (config as any).removeProviderToken,
        skipLocalStorage: config.skipLocalStorage,
      }
    );

    // Collect all enabled tool names from integrations
    for (const integration of this.integrations) {
      for (const toolName of integration.tools) {
        this.enabledToolNames.add(toolName);
      }

      // Initialize auth state for integrations with OAuth
      // Set to false initially, will be updated after tokens are loaded
      if (integration.oauth) {
        const provider = integration.oauth.provider;
        this.authState.set(provider, { authenticated: false });
      }
    }

    // Get list of OAuth providers
    const providers = this.integrations
      .filter(p => p.oauth)
      .map(p => p.oauth!.provider);

    // Determine if we're using database callbacks or localStorage
    const usingDatabaseCallbacks = !!(config as any).getProviderToken;

    if (usingDatabaseCallbacks) {
      // Database callbacks: Load tokens asynchronously
      // This ensures isAuthorized() returns the correct value after tokens are loaded
      // Only update state if it hasn't been changed by other methods (e.g., authorize, reauthenticate)
      this.oauthManager.loadAllProviderTokens(providers).then(async () => {
        // Update auth state based on loaded tokens
        for (const integration of this.integrations) {
          if (integration.oauth) {
            const provider = integration.oauth.provider;
            try {
              // getProviderToken returns from cache after loadAllProviderTokens
              const tokenData = await this.oauthManager.getProviderToken(provider);
              // Only update if state is still at initial false value (not changed by other methods)
              const currentState = this.authState.get(provider);
              if (currentState && !currentState.authenticated && !currentState.lastError) {
                this.authState.set(provider, { authenticated: !!tokenData });
              }
            } catch (error) {
              console.error(`Failed to check token for ${provider}:`, error);
              // Only set to false if state hasn't been modified
              const currentState = this.authState.get(provider);
              if (currentState && !currentState.authenticated && !currentState.lastError) {
                this.authState.set(provider, { authenticated: false });
              }
            }
          }
        }
      }).catch(error => {
        console.error('Failed to load provider tokens:', error);
      });
    } else {
      // localStorage: Load tokens synchronously for immediate availability
      // Always load existing tokens first, even if there's an OAuth callback pending
      // This ensures any previously saved tokens are available immediately
      this.oauthManager.loadAllProviderTokensSync(providers);
      
      // Update auth state immediately based on loaded tokens (synchronously)
      for (const integration of this.integrations) {
        if (integration.oauth) {
          const provider = integration.oauth.provider;
          // Get token from cache synchronously (cache was just populated above)
          const tokenData = this.oauthManager.getProviderTokenFromCache(provider);
          if (tokenData) {
            this.authState.set(provider, { authenticated: true });
          }
        }
      }
    }

    // Initialize integration namespaces dynamically based on configuration
    const integrationIds = this.integrations.map(i => i.id);
    if (integrationIds.includes("github")) {
      (this as any).github = this.createIntegrationProxy("github");
    }
    if (integrationIds.includes("gmail")) {
      (this as any).gmail = this.createIntegrationProxy("gmail");
    }
    if (integrationIds.includes("notion")) {
      (this as any).notion = this.createIntegrationProxy("notion");
    }
    
    // Server namespace is always available
    this.server = this.createServerProxy() as any;

    // Initialize integrations
    this.initializeIntegrations();
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
      return 'http://localhost:3000/api/integrate/oauth/callback';
    }

    // Construct redirect URI from window.location.origin + OAuth API base path
    const origin = window.location.origin;
    // Normalize the API base path and append '/callback'
    const normalizedPath = oauthApiBase.replace(/\/$/, ''); // Remove trailing slash if present
    return `${origin}${normalizedPath}/callback`;
  }

  /**
   * Create a proxy for a integration namespace that intercepts method calls
   * and routes them to the appropriate tool
   * Returns undefined if the integration is not configured
   */
  private createIntegrationProxy(integrationId: string): any {
    // Check if this integration exists in the configured integrations
    const hasIntegration = this.integrations.some(integration => integration.id === integrationId);
    
    if (!hasIntegration) {
      return undefined;
    }
    
    return new Proxy({}, {
      get: (_target, methodName: string) => {
        // Return a function that calls the tool
        return async (args?: Record<string, unknown>, options?: ToolCallOptions) => {
          // When routing through API handlers, skip ensureConnected
          // The tool will be validated by the server-side handler
          const toolName = methodToToolName(methodName, integrationId);
          return await this.callToolWithRetry(toolName, args, 0, options);
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
        return async (args?: Record<string, unknown>, options?: ToolCallOptions) => {
          // When routing through API handlers, skip ensureConnected
          const toolName = methodToToolName(methodName, "");
          // Remove leading underscore if present
          const finalToolName = toolName.startsWith("_") ? toolName.substring(1) : toolName;
          return await this.callServerToolInternal(finalToolName, args, options);
        };
      },
    });
  }

  /**
   * Internal implementation for calling server tools
   */
  private async callServerToolInternal(
    name: string,
    args?: Record<string, unknown>,
    options?: ToolCallOptions
  ): Promise<MCPToolCallResponse> {
    // When routing through API handlers, server-side validates tools
    try {
      // Route through API handler (server tools don't have providers)
      const response = await this.callToolThroughHandler(name, args, undefined, options);
      return response;
    } catch (error) {
      // For server tools, we don't have provider info, so just parse the error
      const parsedError = parseServerError(error, { toolName: name });
      throw parsedError;
    }
  }

  /**
   * Initialize all integrations
   */
  private async initializeIntegrations(): Promise<void> {
    for (const integration of this.integrations) {
      if (integration.onInit) {
        await integration.onInit(this);
      }
    }
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    // Call onBeforeConnect hooks
    for (const integration of this.integrations) {
      if (integration.onBeforeConnect) {
        await integration.onBeforeConnect(this);
      }
    }

    // Connect transport
    await this.transport.connect();

    // Initialize protocol
    await this.initialize();

    // Discover available tools
    await this.discoverTools();

    // Call onAfterConnect hooks
    for (const integration of this.integrations) {
      if (integration.onAfterConnect) {
        await integration.onAfterConnect(this);
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
      `Discovered ${response.tools.length} tools, ${enabledTools.length} enabled by integrations`
    );
  }

  /**
   * Internal method for integrations to call tools by name
   * Used by integrations like Vercel AI that need to map from tool names
   * @internal
   */
  async _callToolByName(
    name: string,
    args?: Record<string, unknown>,
    options?: ToolCallOptions
  ): Promise<MCPToolCallResponse> {
    return await this.callToolWithRetry(name, args, 0, options);
  }

  /**
   * Call any available tool on the server by name, bypassing integration restrictions
   * Useful for server-level tools like 'list_tools_by_integration' that don't belong to a specific integration
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
    // When routing through API handlers, no initialization required
    // The server-side handler will validate tools
    try {
      // Route through API handler (server tools don't have providers)
      const response = await this.callToolThroughHandler(name, args);
      return response;
    } catch (error) {
      // For server tools, we don't have provider info, so just parse the error
      const parsedError = parseServerError(error, { toolName: name });
      throw parsedError;
    }
  }

  /**
   * Call a tool through the API handler (server-side route) for browser clients,
   * or directly through transport for server-side clients with API keys
   */
  private async callToolThroughHandler(
    name: string,
    args?: Record<string, unknown>,
    provider?: string,
    options?: ToolCallOptions
  ): Promise<MCPToolCallResponse> {
    // Check if this is a server-side client (has API key in transport headers)
    const transportHeaders = (this.transport as any).headers || {};
    const hasApiKey = !!transportHeaders['X-API-KEY'];

    // Server-side clients with API key should call MCP server directly through transport
    if (hasApiKey) {
      // Add provider token to transport if available
      if (provider) {
        const tokenData = await this.oauthManager.getProviderToken(provider, options?.context);
        if (tokenData && this.transport.setHeader) {
          const previousAuthHeader = transportHeaders['Authorization'];
          
          try {
            // Temporarily set the authorization header
            this.transport.setHeader('Authorization', `Bearer ${tokenData.accessToken}`);
            
            // Call through transport (goes directly to MCP server with API key)
            const result = await this.transport.sendRequest('tools/call', {
              name,
              arguments: args || {},
            });
            return result as MCPToolCallResponse;
          } finally {
            // Restore previous auth header
            if (previousAuthHeader && this.transport.setHeader) {
              this.transport.setHeader('Authorization', previousAuthHeader);
            } else if (this.transport.removeHeader) {
              this.transport.removeHeader('Authorization');
            }
          }
        }
      }

      // No provider token needed or available - call directly
      const result = await this.transport.sendRequest('tools/call', {
        name,
        arguments: args || {},
      });
      return result as MCPToolCallResponse;
    }

    // Browser clients (no API key) - route through API handler
    // Construct URL: {apiBaseUrl}{apiRouteBase}/mcp
    // If apiBaseUrl is not set, use relative URL (same origin)
    const url = this.apiBaseUrl 
      ? `${this.apiBaseUrl}${this.apiRouteBase}/mcp`
      : `${this.apiRouteBase}/mcp`;

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add provider token if available
    if (provider) {
      const tokenData = await this.oauthManager.getProviderToken(provider, options?.context);
      if (tokenData) {
        headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
      }
    }

    // Make request to API handler
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        arguments: args,
      }),
    });

    if (!response.ok) {
      // Try to parse error response
      let errorMessage = `Request failed: ${response.statusText}`;
      const error = new Error(errorMessage) as Error & { statusCode?: number; code?: number; data?: unknown; jsonrpcError?: unknown };
      error.statusCode = response.status;

      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = typeof errorData.error === 'string' ? errorData.error : errorData.error.message || errorMessage;
          error.message = errorMessage;
        }
        if (errorData.code) {
          error.code = errorData.code;
        }
        if (errorData.data) {
          error.data = errorData.data;
        }
        // Preserve JSON-RPC error structure if present
        if (errorData.error && typeof errorData.error === 'object') {
          error.jsonrpcError = errorData.error;
        }
      } catch {
        // If JSON parsing fails, use status text (already set)
      }

      throw error;
    }

    const result = await response.json();
    return result as MCPToolCallResponse;
  }

  /**
   * Internal method to call a tool with retry logic
   */
  private async callToolWithRetry(
    name: string,
    args?: Record<string, unknown>,
    retryCount = 0,
    options?: ToolCallOptions
  ): Promise<MCPToolCallResponse> {
    // When routing through API handlers, we don't need to check initialization
    // The server-side handler will validate tools and permissions
    if (!this.enabledToolNames.has(name)) {
      throw new Error(
        `Tool "${name}" is not enabled. Enable it by adding the appropriate integration.`
      );
    }

    // Get provider for this tool
    const provider = this.getProviderForTool(name);

    try {
      // Route through API handler instead of direct MCP server call
      const response = await this.callToolThroughHandler(name, args, provider, options);

      // Mark provider as authenticated on success
      if (provider) {
        this.authState.set(provider, { authenticated: true });
      }

      return response;
    } catch (error) {
      // Parse the error to determine if it's an auth error
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
    for (const integration of this.integrations) {
      if (integration.tools.includes(toolName) && integration.oauth) {
        return integration.oauth.provider;
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
   * Set a custom HTTP header for all requests to the MCP server
   * 
   * @internal Used by createMCPServer() to set the API key header
   */
  setRequestHeader(key: string, value: string): void {
    this.transport.setHeader(key, value);
  }

  /**
   * Get all enabled tools (filtered by integrations)
   */
  getEnabledTools(): MCPTool[] {
    return Array.from(this.availableTools.values()).filter((tool) =>
      this.enabledToolNames.has(tool.name)
    );
  }

  /**
   * Get OAuth configuration for a integration
   */
  getOAuthConfig(integrationId: string): OAuthConfig | undefined {
    const integration = this.integrations.find((p) => p.id === integrationId);
    return integration?.oauth;
  }

  /**
   * Get all OAuth configurations
   */
  getAllOAuthConfigs(): Map<string, OAuthConfig> {
    const configs = new Map<string, OAuthConfig>();
    for (const integration of this.integrations) {
      if (integration.oauth) {
        configs.set(integration.id, integration.oauth);
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
   * When using database callbacks (server-side), provide context to delete
   * the correct user's token from the database.
   * 
   * @param provider - Provider name to disconnect (e.g., 'github', 'gmail')
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   * 
   * @example
   * ```typescript
   * // Client-side usage (no context needed)
   * await client.disconnectProvider('github');
   * 
   * // Check if still authorized
   * const isAuthorized = await client.isAuthorized('github'); // false
   * ```
   * 
   * @example
   * ```typescript
   * // Server-side usage with context (multi-tenant)
   * const context = await getSessionContext(request);
   * await client.disconnectProvider('github', context);
   * // Token is now deleted from database for the specific user
   * ```
   */
  async disconnectProvider(provider: string, context?: MCPContext): Promise<void> {
    // Verify the provider exists in integrations
    const integration = this.integrations.find(p => p.oauth?.provider === provider);

    if (!integration?.oauth) {
      throw new Error(`No OAuth configuration found for provider: ${provider}`);
    }

    try {
      // Make server-side call to disconnect the provider
      // Pass context so removeProviderToken callback can delete the correct user's token
      await this.oauthManager.disconnectProvider(provider, context);

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
    for (const integration of this.integrations) {
      if (integration.oauth) {
        this.authState.set(integration.oauth.provider, { authenticated: false });
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
    for (const integration of this.integrations) {
      if (integration.onDisconnect) {
        await integration.onDisconnect(this);
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
   * Checks the current token status and updates the cache accordingly.
   * Returns the authorization status that is automatically updated when
   * authorize() or disconnectProvider() are called
   * 
   * Automatically waits for any pending OAuth callback to complete, ensuring
   * the auth state is always up-to-date, even immediately after OAuth redirects
   * 
   * When using database callbacks (server-side), provide context to check
   * the correct user's token. Without context, it will check without user
   * identification (works for single-user scenarios).
   * 
   * @param provider - Provider name (github, gmail, etc.)
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   * @returns Promise that resolves to authorization status
   * 
   * @example
   * ```typescript
   * // Client-side usage (no context needed)
   * const isAuthorized = await client.isAuthorized('github');
   * if (!isAuthorized) {
   *   await client.authorize('github');
   *   // isAuthorized is now automatically true
   *   console.log(await client.isAuthorized('github')); // true
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Server-side usage with context
   * const context = await getSessionContext(request);
   * const isAuthorized = await client.isAuthorized('github', context);
   * ```
   */
  async isAuthorized(provider: string, context?: MCPContext): Promise<boolean> {
    // Wait for any pending OAuth callback to complete first
    if (this.oauthCallbackPromise) {
      await this.oauthCallbackPromise;
      this.oauthCallbackPromise = null; // Clear it after first use
    }
    
    // Check current token status and update cache
    // Pass context to getProviderToken so it can retrieve the correct user's token from database
    try {
      const tokenData = await this.oauthManager.getProviderToken(provider, context);
      const isAuthenticated = !!tokenData;
      
      // Update the cache with current value
      const currentState = this.authState.get(provider);
      if (currentState) {
        currentState.authenticated = isAuthenticated;
        // Clear lastError if we now have a valid token
        if (isAuthenticated) {
          currentState.lastError = undefined;
        }
      } else {
        // Initialize state if it doesn't exist
        this.authState.set(provider, { authenticated: isAuthenticated });
      }
      
      return isAuthenticated;
    } catch (error) {
      // If there's an error checking the token, update cache to false
      const currentState = this.authState.get(provider);
      if (currentState) {
        currentState.authenticated = false;
      } else {
        this.authState.set(provider, { authenticated: false });
      }
      return false;
    }
  }

  /**
   * Get list of all authorized providers
   * Returns cached authorization status for all configured OAuth providers
   * 
   * Automatically waits for any pending OAuth callback to complete
   * 
   * @returns Promise that resolves to array of authorized provider names
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
    // Wait for any pending OAuth callback to complete first
    if (this.oauthCallbackPromise) {
      await this.oauthCallbackPromise;
      this.oauthCallbackPromise = null; // Clear it after first use
    }

    const authorized: string[] = [];

    // Check each integration with OAuth config
    for (const integration of this.integrations) {
      if (integration.oauth) {
        const provider = integration.oauth.provider;
        if (this.authState.get(provider)?.authenticated) {
          authorized.push(provider);
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
   * @param options.useExistingConnection - If true and a connection exists, skip OAuth and use existing token. If false or undefined, proceed with OAuth flow (allows creating new account even if one exists)
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
   * 
   * // Use existing connection if available
   * await client.authorize('github', { 
   *   useExistingConnection: true 
   * });
   * 
   * // Force new connection (default behavior)
   * await client.authorize('github', { 
   *   useExistingConnection: false 
   * });
   * ```
   */
  async authorize(provider: string, options?: { returnUrl?: string; useExistingConnection?: boolean }): Promise<void> {
    const integration = this.integrations.find(p => p.oauth?.provider === provider);

    if (!integration?.oauth) {
      const error = new Error(`No OAuth configuration found for provider: ${provider}`);
      this.eventEmitter.emit('auth:error', { provider, error });
      throw error;
    }

    // Check if we should use existing connection
    if (options?.useExistingConnection) {
      const authStatus = await this.oauthManager.checkAuthStatus(provider);
      
      if (authStatus.authorized) {
        // Connection exists, use it without OAuth flow
        const tokenData = await this.oauthManager.getProviderToken(provider);
        
        if (tokenData) {
          // Emit auth:complete event with existing token
          this.eventEmitter.emit('auth:complete', {
            provider,
            accessToken: tokenData.accessToken,
            expiresAt: tokenData.expiresAt
          });
          
          // Update auth state
          this.authState.set(provider, { authenticated: true });
        }
        
        // Return early, skipping OAuth flow
        return;
      }
      // If useExistingConnection is true but no connection exists, fall through to OAuth flow
    }

    // Emit auth:started event
    this.eventEmitter.emit('auth:started', { provider });

    try {
      await this.oauthManager.initiateFlow(provider, integration.oauth, options?.returnUrl);

      // Get the provider token after authorization
      const tokenData = await this.oauthManager.getProviderToken(provider);

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
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   * @returns Provider token data or undefined if not authorized
   */
  async getProviderToken(provider: string, context?: MCPContext): Promise<import('./oauth/types.js').ProviderTokenData | undefined> {
    return await this.oauthManager.getProviderToken(provider, context);
  }

  /**
   * Set provider token manually
   * Use this if you have an existing provider token
   * 
   * @param provider - Provider name
   * @param tokenData - Provider token data
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   */
  async setProviderToken(provider: string, tokenData: import('./oauth/types.js').ProviderTokenData, context?: MCPContext): Promise<void> {
    await this.oauthManager.setProviderToken(provider, tokenData, context);
    this.authState.set(provider, { authenticated: true });
  }

  /**
   * Get all provider tokens
   * Returns a map of provider names to access tokens
   * Useful for server-side usage where you need to pass tokens from client to server
   * 
   * Note: This returns tokens from the in-memory cache. For fresh data from database,
   * ensure tokens are loaded first via loadAllProviderTokens or individual getProviderToken calls.
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
      throw new Error(`Provider "${provider}" not found in configured integrations`);
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

  // Only register signal handlers in proper Node.js environments
  // Check for process.on and process.exit to avoid issues with bundlers/edge runtimes
  if (typeof process !== 'undefined' && typeof process.on === 'function' && typeof process.exit === 'function') {
    try {
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
    } catch (error) {
      // Silently ignore if we can't register handlers (e.g., in bundlers/edge runtimes)
    }
  }
}

/**
 * Generate a cache key for a client configuration
 */
function generateCacheKey<TIntegrations extends readonly MCPIntegration[]>(
  config: MCPClientConfig<TIntegrations>
): string {
  // Create a stable key based on configuration
  const parts = [
    config.serverUrl || 'default',
    config.clientInfo?.name || 'integrate-sdk',
    config.clientInfo?.version || '0.1.0',
    JSON.stringify(config.integrations.map(p => ({ id: p.id, tools: p.tools }))),
    JSON.stringify(config.headers || {}),
    config.timeout?.toString() || '30000',
  ];
  return parts.join('|');
}

/**
 * Create a new MCP Client instance (CLIENT-SIDE)
 * 
 * By default, uses singleton pattern and lazy connection:
 * - Returns cached instance if one exists with same configuration
 * - Automatically connects on first method call
 * - Automatically cleans up on process exit
 * 
 * ⚠️ For server-side usage with API key, use createMCPServer() instead.
 * 
 * @example
 * ```typescript
 * // Client-side usage (no API key)
 * const client = createMCPClient({
 *   integrations: [
 *     githubIntegration({ clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID }),
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
 *   integrations: [githubIntegration({ clientId: '...' })],
 *   connectionMode: 'manual',
 *   singleton: false,
 * });
 * 
 * await client.connect();
 * const repos = await client.github.listOwnRepos({});
 * await client.disconnect();
 * ```
 */
export function createMCPClient<TIntegrations extends readonly MCPIntegration[]>(
  config: MCPClientConfig<TIntegrations>
): MCPClient<TIntegrations> {
  const useSingleton = config.singleton ?? true;
  const connectionMode = config.connectionMode ?? 'lazy';
  const autoCleanup = config.autoCleanup ?? true;

  // Check cache for existing instance
  if (useSingleton) {
    const cacheKey = generateCacheKey(config);
    const existing = clientCache.get(cacheKey);

    if (existing && existing.isConnected()) {
      return existing as MCPClient<TIntegrations>;
    }

    // Remove stale entry if exists
    if (existing) {
      clientCache.delete(cacheKey);
      cleanupClients.delete(existing);
    }

    // Create new instance
    const client = new MCPClientBase(config) as MCPClient<TIntegrations>;
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
      processOAuthCallbackFromHash(client, config.oauthCallbackErrorBehavior);
    }

    return client;
  } else {
    // Non-singleton: create fresh instance
    const client = new MCPClientBase(config) as MCPClient<TIntegrations>;

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
    // This is done synchronously to ensure tokens are loaded before client is used
    if (config.autoHandleOAuthCallback !== false) {
      client.oauthCallbackPromise = processOAuthCallbackFromHash(client, config.oauthCallbackErrorBehavior);
    }

    return client;
  }
}

/**
 * Process OAuth callback from URL hash fragment
 * Automatically detects and processes #oauth_callback={...} in the URL
 * Returns a promise that resolves when callback processing is complete
 */
function processOAuthCallbackFromHash(
  client: MCPClientBase<any>,
  errorBehavior?: { mode: 'silent' | 'console' | 'redirect'; redirectUrl?: string }
): Promise<void> | null {
  // Only run in browser environment with proper window.location
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  // Default to silent mode
  const mode = errorBehavior?.mode || 'silent';

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
          // Process the callback and return the promise
          // handleOAuthCallback will save the token and update auth state
          return client.handleOAuthCallback(callbackParams).then(() => {
            // Clean up URL hash after successful callback
            if (mode !== 'redirect' || !errorBehavior?.redirectUrl) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }).catch((error) => {
            // Handle error based on configured behavior
            if (mode === 'console') {
              console.error('Failed to process OAuth callback:', error);
            } else if (mode === 'redirect' && errorBehavior?.redirectUrl) {
              // Redirect to error page
              window.location.href = errorBehavior.redirectUrl;
              return; // Don't clean up hash, let the redirect happen
            }
            // 'silent' mode: do nothing, just clean up hash
            if (mode !== 'redirect' || !errorBehavior?.redirectUrl) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          });
        }
      }
    }
  } catch (error) {
    // Handle parsing errors based on configured behavior
    if (mode === 'console') {
      console.error('Failed to process OAuth callback from hash:', error);
    } else if (mode === 'redirect' && errorBehavior?.redirectUrl) {
      window.location.href = errorBehavior.redirectUrl;
      return null;
    }
    // 'silent' mode: suppress error
    
    // Clean up URL hash on error (unless redirecting)
    try {
      if (mode !== 'redirect' || !errorBehavior?.redirectUrl) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  
  return null;
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

