/**
 * Base OAuth Handler
 * Framework-agnostic OAuth route logic for secure server-side token management
 */

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
}

/**
 * Request body for authorize endpoint
 */
export interface AuthorizeRequest {
  provider: string;
  scopes: string[];
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
   * 
   * @param request - Authorization request from client
   * @returns Authorization URL to redirect/open for user
   * 
   * @throws Error if provider is not configured
   * @throws Error if MCP server request fails
   */
  async handleAuthorize(request: AuthorizeRequest): Promise<AuthorizeResponse> {    
    // Get OAuth config from environment (server-side)
    const providerConfig = this.config.providers[request.provider];
    if (!providerConfig) {
      throw new Error(`Provider ${request.provider} not configured. Add OAuth credentials to your API route configuration.`);
    }

    // Validate required fields
    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      throw new Error(`Missing OAuth credentials for ${request.provider}. Check your environment variables.`);
    }

    // Build URL to MCP server
    const url = new URL('/oauth/authorize', this.serverUrl);
    url.searchParams.set('provider', request.provider);
    url.searchParams.set('client_id', providerConfig.clientId);
    url.searchParams.set('client_secret', providerConfig.clientSecret);
    url.searchParams.set('scope', request.scopes.join(','));
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', request.codeChallengeMethod);
    
    // Use request redirect URI or fallback to provider config
    const redirectUri = request.redirectUri || providerConfig.redirectUri;
    if (redirectUri) {
      url.searchParams.set('redirect_uri', redirectUri);
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
    return data as AuthorizeResponse;
  }

  /**
   * Handle OAuth callback
   * Exchanges authorization code for access token
   * 
   * @param request - Callback request with authorization code
   * @returns Access token and authorization details
   * 
   * @throws Error if provider is not configured
   * @throws Error if MCP server request fails
   */
  async handleCallback(request: CallbackRequest): Promise<CallbackResponse> {
    // Debug: Log what we're trying to access
    
    // Get OAuth config from environment (server-side)
    const providerConfig = this.config.providers[request.provider];

    if (!providerConfig) {
      throw new Error(`Provider ${request.provider} not configured. Add OAuth credentials to your API route configuration.`);
    }

    // Validate required fields
    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      throw new Error(`Missing OAuth credentials for ${request.provider}. Check your environment variables.`);
    }

    // Forward to MCP server for token exchange with credentials
    const url = new URL('/oauth/callback', this.serverUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        provider: request.provider,
        code: request.code,
        code_verifier: request.codeVerifier,
        state: request.state,
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
    return data as CallbackResponse;
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

