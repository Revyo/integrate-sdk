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
  sessionToken: string;
  provider: string;
  scopes: string[];
  expiresAt?: number;
}

/**
 * Response from status endpoint
 */
export interface StatusResponse {
  authorized: boolean;
  provider: string;
  scopes?: string[];
  expiresAt?: number;
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
 * OAuth Handler
 * Handles OAuth authorization flows by proxying requests to MCP server
 * with server-side OAuth credentials from environment variables
 */
export class OAuthHandler {
  private readonly serverUrl = MCP_SERVER_URL;
  
  constructor(private config: OAuthHandlerConfig) {}

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
   * Exchanges authorization code for session token
   * 
   * @param request - Callback request with authorization code
   * @returns Session token and authorization details
   * 
   * @throws Error if MCP server request fails
   */
  async handleCallback(request: CallbackRequest): Promise<CallbackResponse> {
    // Forward to MCP server for token exchange
    const url = new URL('/oauth/callback', this.serverUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: request.provider,
        code: request.code,
        code_verifier: request.codeVerifier,
        state: request.state,
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
   * Checks if a provider is currently authorized
   * 
   * @param provider - Provider to check
   * @param sessionToken - Session token from client
   * @returns Authorization status
   * 
   * @throws Error if MCP server request fails
   */
  async handleStatus(provider: string, sessionToken: string): Promise<StatusResponse> {
    // Forward to MCP server
    const url = new URL('/oauth/status', this.serverUrl);
    url.searchParams.set('provider', provider);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Session-Token': sessionToken,
      },
    });

    if (!response.ok) {
      // If unauthorized, return not authorized status
      if (response.status === 401) {
        return {
          authorized: false,
          provider,
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
   * @param sessionToken - Session token from client
   * @returns Disconnect response
   * 
   * @throws Error if no session token provided
   * @throws Error if MCP server request fails
   */
  async handleDisconnect(request: DisconnectRequest, sessionToken: string): Promise<DisconnectResponse> {
    if (!sessionToken) {
      throw new Error('No session token provided. Cannot disconnect provider.');
    }

    // Forward to MCP server to revoke authorization
    const url = new URL('/oauth/disconnect', this.serverUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
      },
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
}

