/**
 * Base OAuth Handler
 * Framework-agnostic OAuth route logic for secure server-side token management
 */

import type { MCPContext } from '../config/types.js';
import type { ProviderTokenData } from '../oauth/types.js';

/**
 * MCP Server URL - managed by Integrate
 */
const MCP_SERVER_URL = 'https://mcp.integrate.dev/api/v1/mcp';

/**
 * OAuth handler configuration
 * OAuth credentials for each provider
 */
export interface OAuthHandlerConfig {
  /** OAuth configurations by provider */
  providers: Record<string, {
    /** OAuth client ID from environment variables */
    clientId: string;
    /** OAuth client secret from environment variables */
    clientSecret: string;
    /** Optional redirect URI override */
    redirectUri?: string;
    /** Optional scopes for OAuth authorization */
    scopes?: string[];
    /** Optional provider-specific configuration (e.g., Notion's 'owner' parameter) */
    config?: Record<string, any>;
  }>;
  /**
   * MCP Server URL
   * @default 'https://mcp.integrate.dev/api/v1/mcp'
   */
  serverUrl?: string;
  /**
   * API Key for authentication and usage tracking (SERVER-SIDE ONLY)
   * Sent as X-API-KEY header with all OAuth requests to the MCP server
   */
  apiKey?: string;
  /**
   * Optional callback to extract user context from request
   * If not provided, SDK will attempt to auto-detect from common auth libraries
   * 
   * @param request - Web Request object
   * @returns User context (userId, organizationId, etc.) or undefined
   * 
   * @example
   * ```typescript
   * getSessionContext: async (req) => {
   *   const session = await getMyAuthSession(req);
   *   return { userId: session.userId };
   * }
   * ```
   */
  getSessionContext?: (request: Request) => Promise<MCPContext | undefined> | MCPContext | undefined;
  /**
   * Optional callback to save provider tokens with user context
   * Called automatically after successful OAuth callback
   * 
   * @param provider - Provider name (e.g., 'github')
   * @param tokenData - OAuth tokens (accessToken, refreshToken, etc.)
   * @param context - User context (userId, organizationId, etc.)
   * 
   * @example
   * ```typescript
   * setProviderToken: async (provider, tokens, context) => {
   *   await db.tokens.upsert({
   *     where: { provider_userId: { provider, userId: context.userId } },
   *     create: { provider, userId: context.userId, ...tokens },
   *     update: tokens,
   *   });
   * }
   * ```
   */
  setProviderToken?: (provider: string, tokenData: ProviderTokenData, context?: MCPContext) => Promise<void> | void;
}

/**
 * Request body for authorize endpoint
 */
export interface AuthorizeRequest {
  provider: string;
  scopes?: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri?: string;
}

/**
 * Response from authorize endpoint
 */
export interface AuthorizeResponse {
  authorizationUrl: string;
  /** Optional Set-Cookie header value for context cookie */
  setCookie?: string;
}

/**
 * Request body for callback endpoint
 */
export interface CallbackRequest {
  provider: string;
  code: string;
  codeVerifier: string;
  state: string;
}

/**
 * Response from callback endpoint
 */
export interface CallbackResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt?: string;
  scopes?: string[];
  /** Optional Set-Cookie header value to clear context cookie */
  clearCookie?: string;
}

/**
 * Response from status endpoint
 */
export interface StatusResponse {
  authorized: boolean;
  scopes?: string[];
  expiresAt?: string;
}

/**
 * Request body for disconnect endpoint
 */
export interface DisconnectRequest {
  provider: string;
}

/**
 * Response from disconnect endpoint
 */
export interface DisconnectResponse {
  success: boolean;
  provider: string;
}

/**
 * Request body for MCP tool call endpoint
 */
export interface ToolCallRequest {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * Response from MCP tool call endpoint
 * Matches MCPToolCallResponse structure
 */
export interface ToolCallResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

/**
 * OAuth Handler
 * Handles OAuth authorization flows by proxying requests to MCP server
 * with server-side OAuth credentials from environment variables
 */
export class OAuthHandler {
  private readonly serverUrl: string;
  private readonly apiKey?: string;
  
  constructor(private config: OAuthHandlerConfig) {
    // Validate config on initialization
    if (!config || !config.providers) {
      throw new Error('OAuthHandler requires a valid config with providers');
    }
    
    // Use configured serverUrl or default
    this.serverUrl = config.serverUrl || MCP_SERVER_URL;
    this.apiKey = config.apiKey;
  }
  
  /**
   * Get headers with API key if configured
   */
  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...additionalHeaders,
    };
    
    // Add API key header if configured (for usage tracking)
    if (this.apiKey) {
      headers['X-API-KEY'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * Handle authorization URL request
   * Gets authorization URL from MCP server with full OAuth credentials
   * Also captures user context for later use in callback
   * 
   * @param request - Authorization request from client OR full Web Request object
   * @returns Authorization URL to redirect/open for user, plus optional context cookie
   * 
   * @throws Error if provider is not configured
   * @throws Error if MCP server request fails
   */
  async handleAuthorize(request: AuthorizeRequest | Request): Promise<AuthorizeResponse> {
    // Determine if request is a Web Request or parsed body
    let webRequest: Request | undefined;
    let authorizeRequest: AuthorizeRequest;
    
    if (request instanceof Request) {
      // Full Web Request object - extract body
      webRequest = request;
      authorizeRequest = await request.json();
    } else if (typeof request === 'object' && 'json' in request && typeof request.json === 'function') {
      // Mock Request-like object with json() method (for testing)
      authorizeRequest = await request.json();
    } else {
      // Already parsed AuthorizeRequest
      authorizeRequest = request as AuthorizeRequest;
    }
    
    // Get OAuth config from environment (server-side)
    const providerConfig = this.config.providers[authorizeRequest.provider];
    if (!providerConfig) {
      throw new Error(`Provider ${authorizeRequest.provider} not configured. Add OAuth credentials to your API route configuration.`);
    }

    // Validate required fields
    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      throw new Error(`Missing OAuth credentials for ${authorizeRequest.provider}. Check your environment variables.`);
    }

    // Build URL to MCP server
    const url = new URL('/oauth/authorize', this.serverUrl);
    url.searchParams.set('provider', authorizeRequest.provider);
    url.searchParams.set('client_id', providerConfig.clientId);
    url.searchParams.set('client_secret', providerConfig.clientSecret);
    
    // Use scopes from request if provided, otherwise use provider config scopes
    const scopes = authorizeRequest.scopes || providerConfig.scopes || [];
    if (scopes.length > 0) {
      url.searchParams.set('scope', scopes.join(','));
    }
    
    url.searchParams.set('state', authorizeRequest.state);
    url.searchParams.set('code_challenge', authorizeRequest.codeChallenge);
    url.searchParams.set('code_challenge_method', authorizeRequest.codeChallengeMethod);
    
    // Use request redirect URI or fallback to provider config
    const redirectUri = authorizeRequest.redirectUri || providerConfig.redirectUri;
    if (redirectUri) {
      url.searchParams.set('redirect_uri', redirectUri);
    }
    
    // Add provider-specific config parameters (e.g., Notion's 'owner' parameter)
    if (providerConfig.config) {
      for (const [key, value] of Object.entries(providerConfig.config)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Forward to MCP server
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP server failed to generate authorization URL: ${error}`);
    }

    const data = await response.json();
    const result: AuthorizeResponse = data as AuthorizeResponse;
    
    // Try to capture user context if Web Request is available
    if (webRequest) {
      try {
        const { detectSessionContext } = await import('./session-detector.js');
        const { createContextCookie, getSetCookieHeader } = await import('./context-cookie.js');
        
        // Try custom session context extractor first
        let context: MCPContext | undefined;
        if (this.config.getSessionContext) {
          context = await this.config.getSessionContext(webRequest);
        }
        
        // Fallback to automatic detection
        if (!context || !context.userId) {
          context = await detectSessionContext(webRequest);
        }
        
        // If we have user context, create encrypted cookie
        if (context && context.userId) {
          // Use API key or provider secret as encryption key
          const secret = this.apiKey || providerConfig.clientSecret;
          const cookieValue = await createContextCookie(context, authorizeRequest.provider, secret);
          result.setCookie = getSetCookieHeader(cookieValue);
        }
      } catch (error) {
        // Context capture failed - continue without it
        // This is not a fatal error since user can still complete OAuth manually
        console.warn('[OAuth] Failed to capture user context:', error);
      }
    }
    
    return result;
  }

  /**
   * Handle OAuth callback
   * Exchanges authorization code for access token
   * Also restores user context and saves tokens if callback is configured
   * 
   * @param request - Callback request with authorization code OR full Web Request object
   * @returns Access token and authorization details, plus cookie clear header
   * 
   * @throws Error if provider is not configured
   * @throws Error if MCP server request fails
   */
  async handleCallback(request: CallbackRequest | Request): Promise<CallbackResponse> {
    // Determine if request is a Web Request or parsed body
    let webRequest: Request | undefined;
    let callbackRequest: CallbackRequest;
    
    if (request instanceof Request) {
      // Full Web Request object - extract body
      webRequest = request;
      callbackRequest = await request.json();
    } else if (typeof request === 'object' && 'json' in request && typeof request.json === 'function') {
      // Mock Request-like object with json() method (for testing)
      callbackRequest = await request.json();
    } else {
      // Already parsed CallbackRequest
      callbackRequest = request as CallbackRequest;
    }
    
    // Get OAuth config from environment (server-side)
    const providerConfig = this.config.providers[callbackRequest.provider];

    if (!providerConfig) {
      throw new Error(`Provider ${callbackRequest.provider} not configured. Add OAuth credentials to your API route configuration.`);
    }

    // Validate required fields
    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      throw new Error(`Missing OAuth credentials for ${callbackRequest.provider}. Check your environment variables.`);
    }

    // Try to restore user context from cookie if Web Request is available
    let context: MCPContext | undefined;
    if (webRequest) {
      try {
        const { getContextCookieFromRequest, readContextCookie } = await import('./context-cookie.js');
        const cookieValue = getContextCookieFromRequest(webRequest);
        
        if (cookieValue) {
          // Use API key or provider secret as decryption key
          const secret = this.apiKey || providerConfig.clientSecret;
          const contextData = await readContextCookie(cookieValue, secret);
          
          if (contextData && contextData.provider === callbackRequest.provider) {
            context = contextData.context;
          }
        }
      } catch (error) {
        // Context restoration failed - continue without it
        console.warn('[OAuth] Failed to restore user context:', error);
      }
    }

    // Forward to MCP server for token exchange with credentials
    const url = new URL('/oauth/callback', this.serverUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        provider: callbackRequest.provider,
        code: callbackRequest.code,
        code_verifier: callbackRequest.codeVerifier,
        state: callbackRequest.state,
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        redirect_uri: providerConfig.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP server failed to exchange authorization code: ${error}`);
    }

    const data = await response.json();
    const result: CallbackResponse = data as CallbackResponse;
    
    // Call setProviderToken callback if configured
    if (this.config.setProviderToken && context) {
      try {
        const tokenData: ProviderTokenData = {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
          expiresAt: result.expiresAt,
        };
        
        await this.config.setProviderToken(callbackRequest.provider, tokenData, context);
      } catch (error) {
        // Token storage failed - log but don't fail the OAuth flow
        console.error('[OAuth] Failed to save provider token:', error);
      }
    }
    
    // Include cookie clear header if Web Request was provided
    if (webRequest) {
      const { getClearCookieHeader } = await import('./context-cookie.js');
      result.clearCookie = getClearCookieHeader();
    }
    
    return result;
  }

  /**
   * Handle authorization status check
   * Checks if a provider access token is valid
   * 
   * @param provider - Provider to check
   * @param accessToken - Access token from client
   * @returns Authorization status
   * 
   * @throws Error if MCP server request fails
   */
  async handleStatus(provider: string, accessToken: string): Promise<StatusResponse> {
    // Forward to MCP server
    const url = new URL('/oauth/status', this.serverUrl);
    url.searchParams.set('provider', provider);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders({
        'Authorization': `Bearer ${accessToken}`,
      }),
    });

    if (!response.ok) {
      // If unauthorized, return not authorized status
      if (response.status === 401) {
        return {
          authorized: false,
        };
      }

      const error = await response.text();
      throw new Error(`MCP server failed to check authorization status: ${error}`);
    }

    const data = await response.json();
    return data as StatusResponse;
  }

  /**
   * Handle provider disconnection
   * Revokes authorization for a specific provider
   * 
   * @param request - Disconnect request with provider name
   * @param accessToken - Access token from client
   * @returns Disconnect response
   * 
   * @throws Error if no access token provided
   * @throws Error if MCP server request fails
   */
  async handleDisconnect(request: DisconnectRequest, accessToken: string): Promise<DisconnectResponse> {
    if (!accessToken) {
      throw new Error('No access token provided. Cannot disconnect provider.');
    }

    // Forward to MCP server to revoke authorization
    const url = new URL('/oauth/disconnect', this.serverUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }),
      body: JSON.stringify({
        provider: request.provider,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP server failed to disconnect provider: ${error}`);
    }

    const data = await response.json();
    return data as DisconnectResponse;
  }

  /**
   * Handle MCP tool call
   * Forwards tool call requests to MCP server with API key and provider token
   * 
   * @param request - Tool call request with name and arguments
   * @param authHeader - Authorization header from client (Bearer token)
   * @returns Tool call response
   * 
   * @throws Error if MCP server request fails
   */
  async handleToolCall(request: ToolCallRequest, authHeader: string | null): Promise<ToolCallResponse> {
    // Use the MCP server URL directly (JSON-RPC method is in the body, not the path)
    const url = this.serverUrl;

    // Prepare headers with API key
    const headers: Record<string, string> = this.getHeaders({
      'Content-Type': 'application/json',
    });

    // Add provider token from Authorization header if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
      headers['Authorization'] = authHeader;
    }

    // Forward to MCP server using JSON-RPC format
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now() + Math.random(),
      method: 'tools/call',
      params: {
        name: request.name,
        arguments: request.arguments || {},
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonRpcRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP server failed to execute tool call: ${error}`);
    }

    const jsonRpcResponse = await response.json();

    // Handle JSON-RPC error response
    if (jsonRpcResponse.error) {
      const error = new Error(jsonRpcResponse.error.message || 'Tool call failed');
      (error as any).code = jsonRpcResponse.error.code;
      (error as any).data = jsonRpcResponse.error.data;
      throw error;
    }

    // Return the result (which should be ToolCallResponse)
    return jsonRpcResponse.result as ToolCallResponse;
  }
}

