/**
 * OAuth Manager
 * Orchestrates OAuth 2.0 Authorization Code Flow with PKCE
 */

import type { OAuthConfig } from "../plugins/types.js";
import type {
  OAuthFlowConfig,
  PendingAuth,
  AuthStatus,
  AuthorizationUrlResponse,
  OAuthCallbackResponse,
} from "./types.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce.js";
import { OAuthWindowManager } from "./window-manager.js";

/**
 * OAuth Manager
 * Handles OAuth authorization flows and token management
 */
export class OAuthManager {
  private pendingAuths: Map<string, PendingAuth> = new Map();
  private sessionToken?: string;
  private windowManager: OAuthWindowManager;
  private flowConfig: OAuthFlowConfig;
  private oauthApiBase: string;

  constructor(
    oauthApiBase: string,
    flowConfig?: Partial<OAuthFlowConfig>
  ) {
    this.oauthApiBase = oauthApiBase;
    this.windowManager = new OAuthWindowManager();
    this.flowConfig = {
      mode: flowConfig?.mode || 'redirect',
      popupOptions: flowConfig?.popupOptions,
      onAuthCallback: flowConfig?.onAuthCallback,
    };
  }

  /**
   * Initiate OAuth authorization flow
   * 
   * @param provider - OAuth provider (github, gmail, etc.)
   * @param config - OAuth configuration
   * @returns Promise that resolves when authorization is complete
   * 
   * @example
   * ```typescript
   * await oauthManager.initiateFlow('github', {
   *   provider: 'github',
   *   clientId: 'abc123',
   *   clientSecret: 'secret',
   *   scopes: ['repo', 'user']
   * });
   * ```
   */
  async initiateFlow(provider: string, config: OAuthConfig): Promise<void> {
    // 1. Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateState();

    // 2. Store pending auth
    const pendingAuth: PendingAuth = {
      provider,
      state,
      codeVerifier,
      codeChallenge,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
      initiatedAt: Date.now(),
    };
    this.pendingAuths.set(state, pendingAuth);

    // 3. Request authorization URL from user's API route
    const authUrl = await this.getAuthorizationUrl(provider, config.scopes, state, codeChallenge, config.redirectUri);

    // 4. Open authorization URL (popup or redirect)
    if (this.flowConfig.mode === 'popup') {
      this.windowManager.openPopup(authUrl, this.flowConfig.popupOptions);
      
      // Wait for callback from popup
      try {
        const callbackParams = await this.windowManager.listenForCallback('popup');
        await this.handleCallback(callbackParams.code, callbackParams.state);
      } catch (error) {
        // Clean up pending auth on error
        this.pendingAuths.delete(state);
        throw error;
      }
    } else {
      // For redirect mode, just redirect - callback will be handled separately
      this.windowManager.openRedirect(authUrl);
    }
  }

  /**
   * Handle OAuth callback
   * Call this after user authorizes (from your callback page)
   * 
   * @param code - Authorization code from OAuth provider
   * @param state - State parameter for verification
   * @returns Session token for authenticated requests
   * 
   * @example
   * ```typescript
   * // In your callback route
   * const sessionToken = await oauthManager.handleCallback(code, state);
   * ```
   */
  async handleCallback(code: string, state: string): Promise<string> {
    // 1. Verify state and get pending auth
    const pendingAuth = this.pendingAuths.get(state);
    
    if (!pendingAuth) {
      throw new Error('Invalid state parameter: no matching OAuth flow found');
    }

    // Check if auth is not too old (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - pendingAuth.initiatedAt > fiveMinutes) {
      this.pendingAuths.delete(state);
      throw new Error('OAuth flow expired: please try again');
    }

    // Call custom callback handler if provided
    if (this.flowConfig.onAuthCallback) {
      try {
        await this.flowConfig.onAuthCallback(pendingAuth.provider, code, state);
      } catch (error) {
        console.error('Custom OAuth callback handler failed:', error);
      }
    }

    // 2. Send to user's API route for token exchange
    try {
      const response = await this.exchangeCodeForToken(
        pendingAuth.provider,
        code,
        pendingAuth.codeVerifier,
        state
      );

      // 3. Store session token
      this.sessionToken = response.sessionToken;

      // 4. Clean up pending auth
      this.pendingAuths.delete(state);

      return response.sessionToken;
    } catch (error) {
      this.pendingAuths.delete(state);
      throw error;
    }
  }

  /**
   * Check authorization status for a provider
   * 
   * @param provider - OAuth provider to check
   * @returns Authorization status
   * 
   * @example
   * ```typescript
   * const status = await oauthManager.checkAuthStatus('github');
   * if (status.authorized) {
   *   console.log('GitHub is authorized');
   * }
   * ```
   */
  async checkAuthStatus(provider: string): Promise<AuthStatus> {
    if (!this.sessionToken) {
      return {
        authorized: false,
        provider,
      };
    }

    try {
      const url = `${this.oauthApiBase}/status?provider=${encodeURIComponent(provider)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Session-Token': this.sessionToken,
        },
      });

      if (!response.ok) {
        return {
          authorized: false,
          provider,
        };
      }

      const status = await response.json() as AuthStatus;
      return status;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      return {
        authorized: false,
        provider,
      };
    }
  }

  /**
   * Get session token
   */
  getSessionToken(): string | undefined {
    return this.sessionToken;
  }

  /**
   * Set session token (for manual token management)
   */
  setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  /**
   * Clear session token
   */
  clearSessionToken(): void {
    this.sessionToken = undefined;
  }

  /**
   * Request authorization URL from user's API route
   * The API route will add OAuth secrets and forward to MCP server
   */
  private async getAuthorizationUrl(
    provider: string,
    scopes: string[],
    state: string,
    codeChallenge: string,
    redirectUri?: string
  ): Promise<string> {
    const url = `${this.oauthApiBase}/authorize`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        scopes,
        state,
        codeChallenge,
        codeChallengeMethod: 'S256',
        redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get authorization URL: ${error}`);
    }

    const data = await response.json() as AuthorizationUrlResponse;
    return data.authorizationUrl;
  }

  /**
   * Exchange authorization code for session token via user's API route
   * The API route will forward to MCP server
   */
  private async exchangeCodeForToken(
    provider: string,
    code: string,
    codeVerifier: string,
    state: string
  ): Promise<OAuthCallbackResponse> {
    const url = `${this.oauthApiBase}/callback`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        code,
        codeVerifier,
        state,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const data = await response.json() as OAuthCallbackResponse;
    return data;
  }

  /**
   * Close any open OAuth windows
   */
  close(): void {
    this.windowManager.close();
  }
}

