/**
 * OAuth Manager
 * Orchestrates OAuth 2.0 Authorization Code Flow with PKCE
 */

import type { OAuthConfig } from "../integrations/types.js";
import type {
  OAuthFlowConfig,
  PendingAuth,
  AuthStatus,
  AuthorizationUrlResponse,
  OAuthCallbackResponse,
  ProviderTokenData,
} from "./types.js";
import { generateCodeVerifier, generateCodeChallenge, generateStateWithReturnUrl } from "./pkce.js";
import { OAuthWindowManager } from "./window-manager.js";

/**
 * OAuth Manager
 * Handles OAuth authorization flows and token management
 */
export class OAuthManager {
  private pendingAuths: Map<string, PendingAuth> = new Map();
  private providerTokens: Map<string, ProviderTokenData> = new Map();
  private windowManager: OAuthWindowManager;
  private flowConfig: OAuthFlowConfig;
  private oauthApiBase: string;
  private apiBaseUrl?: string;

  constructor(
    oauthApiBase: string,
    flowConfig?: Partial<OAuthFlowConfig>,
    apiBaseUrl?: string
  ) {
    this.oauthApiBase = oauthApiBase;
    this.apiBaseUrl = apiBaseUrl;
    this.windowManager = new OAuthWindowManager();
    this.flowConfig = {
      mode: flowConfig?.mode || 'redirect',
      popupOptions: flowConfig?.popupOptions,
      onAuthCallback: flowConfig?.onAuthCallback,
    };

    // Clean up any expired pending auth entries from localStorage
    this.cleanupExpiredPendingAuths();
  }

  /**
   * Initiate OAuth authorization flow
   * 
   * @param provider - OAuth provider (github, gmail, etc.)
   * @param config - OAuth configuration
   * @param returnUrl - Optional URL to redirect to after OAuth completion
   * @returns Promise that resolves when authorization is complete
   * 
   * @example
   * ```typescript
   * // Basic flow
   * await oauthManager.initiateFlow('github', {
   *   provider: 'github',
   *   clientId: 'abc123',
   *   clientSecret: 'secret',
   *   scopes: ['repo', 'user']
   * });
   * 
   * // With return URL
   * await oauthManager.initiateFlow('github', config, '/marketplace/github');
   * ```
   */
  async initiateFlow(provider: string, config: OAuthConfig, returnUrl?: string): Promise<void> {
    // 1. Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateStateWithReturnUrl(returnUrl);

    // 2. Store pending auth
    const pendingAuth: PendingAuth = {
      provider,
      state,
      codeVerifier,
      codeChallenge,
      scopes: config.scopes,
      redirectUri: config.redirectUri,
      returnUrl,
      initiatedAt: Date.now(),
    };
    this.pendingAuths.set(state, pendingAuth);

    // 3. Save to localStorage (works for both redirect and popup modes)
    // Even in popup mode, browser might convert popup to tab, so we persist as fallback
    this.savePendingAuthToStorage(state, pendingAuth);

    // 4. Request authorization URL from user's API route
    const authUrl = await this.getAuthorizationUrl(provider, config.scopes, state, codeChallenge, config.redirectUri);

    // 5. Open authorization URL (popup or redirect)
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
   * @returns Provider token data with access token
   * 
   * @example
   * ```typescript
   * // In your callback route
   * const tokenData = await oauthManager.handleCallback(code, state);
   * console.log('Access token:', tokenData.accessToken);
   * ```
   */
  async handleCallback(code: string, state: string): Promise<ProviderTokenData & { provider: string }> {
    // 1. Verify state and get pending auth
    let pendingAuth = this.pendingAuths.get(state);

    // If not in memory (page reload), try to load from localStorage
    if (!pendingAuth) {
      pendingAuth = this.loadPendingAuthFromStorage(state);
    }

    if (!pendingAuth) {
      throw new Error('Invalid state parameter: no matching OAuth flow found');
    }

    // Check if auth is not too old (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - pendingAuth.initiatedAt > fiveMinutes) {
      this.pendingAuths.delete(state);
      this.removePendingAuthFromStorage(state);
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

      // 3. Store provider token
      const tokenData: ProviderTokenData = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        tokenType: response.tokenType,
        expiresIn: response.expiresIn,
        expiresAt: response.expiresAt,
        scopes: response.scopes,
      };

      this.providerTokens.set(pendingAuth.provider, tokenData);

      // 4. Save to localStorage
      this.saveProviderToken(pendingAuth.provider, tokenData);

      // 5. Clean up pending auth from both memory and storage
      this.pendingAuths.delete(state);
      this.removePendingAuthFromStorage(state);

      return { ...tokenData, provider: pendingAuth.provider };
    } catch (error) {
      this.pendingAuths.delete(state);
      this.removePendingAuthFromStorage(state);
      throw error;
    }
  }

  /**
   * Check authorization status for a provider
   * Returns whether a token exists locally (stateless check)
   * 
   * Note: This only checks if a token exists locally, not if it's valid.
   * Token validation happens when making actual API calls.
   * 
   * @param provider - OAuth provider to check
   * @returns Authorization status
   * 
   * @example
   * ```typescript
   * const status = await oauthManager.checkAuthStatus('github');
   * if (status.authorized) {
   *   console.log('GitHub token exists locally');
   * }
   * ```
   */
  async checkAuthStatus(provider: string): Promise<AuthStatus> {
    const tokenData = this.providerTokens.get(provider);

    if (!tokenData) {
      return {
        authorized: false,
        provider,
      };
    }

    // Return local token status without server validation
    // Token validity will be checked when making actual API calls
    return {
      authorized: true,
      provider,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expiresAt,
    };
  }

  /**
   * Disconnect a specific provider
   * Clears the local token for the provider (stateless operation)
   * 
   * Note: This only clears the local token. It does not revoke the token
   * on the provider's side. For full revocation, handle that separately
   * in your application if needed.
   * 
   * @param provider - OAuth provider to disconnect
   * @returns Promise that resolves when disconnection is complete
   * 
   * @example
   * ```typescript
   * await oauthManager.disconnectProvider('github');
   * // GitHub token is now cleared locally
   * ```
   */
  async disconnectProvider(provider: string): Promise<void> {
    const tokenData = this.providerTokens.get(provider);

    if (!tokenData) {
      throw new Error(`No access token available for provider "${provider}". Cannot disconnect provider.`);
    }

    // Clear provider token locally (stateless)
    this.providerTokens.delete(provider);
    this.clearProviderToken(provider);
  }

  /**
   * Get provider token data
   */
  getProviderToken(provider: string): ProviderTokenData | undefined {
    return this.providerTokens.get(provider);
  }

  /**
   * Get all provider tokens
   */
  getAllProviderTokens(): Map<string, ProviderTokenData> {
    return new Map(this.providerTokens);
  }

  /**
   * Set provider token (for manual token management)
   */
  setProviderToken(provider: string, tokenData: ProviderTokenData): void {
    this.providerTokens.set(provider, tokenData);
    this.saveProviderToken(provider, tokenData);
  }

  /**
   * Clear specific provider token
   */
  clearProviderToken(provider: string): void {
    this.providerTokens.delete(provider);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`integrate_token_${provider}`);
      } catch (error) {
        console.error(`Failed to clear token for ${provider} from localStorage:`, error);
      }
    }
  }

  /**
   * Clear all provider tokens
   */
  clearAllProviderTokens(): void {
    const providers = Array.from(this.providerTokens.keys());
    this.providerTokens.clear();

    if (typeof window !== 'undefined' && window.localStorage) {
      for (const provider of providers) {
        try {
          window.localStorage.removeItem(`integrate_token_${provider}`);
        } catch (error) {
          console.error(`Failed to clear token for ${provider} from localStorage:`, error);
        }
      }
    }
  }

  /**
   * Clear all pending OAuth flows
   * Removes all pending auths from memory and localStorage
   */
  clearAllPendingAuths(): void {
    // Clear in-memory pending auths
    this.pendingAuths.clear();

    // Clear all pending auths from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const prefix = 'integrate_oauth_pending_';
        const keysToRemove: string[] = [];

        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => window.localStorage.removeItem(key));
      } catch (error) {
        console.error('Failed to clear pending auths from localStorage:', error);
      }
    }
  }

  /**
   * Save provider token to localStorage
   */
  private saveProviderToken(provider: string, tokenData: ProviderTokenData): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `integrate_token_${provider}`;
        window.localStorage.setItem(key, JSON.stringify(tokenData));
      } catch (error) {
        console.error(`Failed to save token for ${provider} to localStorage:`, error);
      }
    }
  }

  /**
   * Load provider token from localStorage
   * Returns undefined if not found or invalid
   */
  private loadProviderToken(provider: string): ProviderTokenData | undefined {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `integrate_token_${provider}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored) as ProviderTokenData;
        }
      } catch (error) {
        console.error(`Failed to load token for ${provider} from localStorage:`, error);
      }
    }
    return undefined;
  }

  /**
   * Load all provider tokens from localStorage on initialization
   */
  loadAllProviderTokens(providers: string[]): void {
    for (const provider of providers) {
      const tokenData = this.loadProviderToken(provider);
      if (tokenData) {
        this.providerTokens.set(provider, tokenData);
      }
    }
  }

  /**
   * Save pending auth to localStorage (for redirect flows)
   * Uses localStorage instead of sessionStorage because OAuth may open in a new tab,
   * and sessionStorage is isolated per tab. localStorage is shared across tabs.
   * Keyed by state parameter for security and retrieval.
   */
  private savePendingAuthToStorage(state: string, pendingAuth: PendingAuth): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `integrate_oauth_pending_${state}`;
        window.localStorage.setItem(key, JSON.stringify(pendingAuth));
      } catch (error) {
        console.error('Failed to save pending auth to localStorage:', error);
      }
    }
  }

  /**
   * Load pending auth from localStorage (after redirect)
   * Returns undefined if not found or invalid
   */
  private loadPendingAuthFromStorage(state: string): PendingAuth | undefined {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `integrate_oauth_pending_${state}`;
        const stored = window.localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored) as PendingAuth;
        }
      } catch (error) {
        console.error('Failed to load pending auth from localStorage:', error);
      }
    }
    return undefined;
  }

  /**
   * Remove pending auth from localStorage
   */
  private removePendingAuthFromStorage(state: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const key = `integrate_oauth_pending_${state}`;
        window.localStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to remove pending auth from localStorage:', error);
      }
    }
  }

  /**
   * Clean up expired pending auth entries from localStorage
   * Removes any entries older than 5 minutes
   */
  private cleanupExpiredPendingAuths(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const prefix = 'integrate_oauth_pending_';
        const fiveMinutes = 5 * 60 * 1000;
        const now = Date.now();

        // Iterate through localStorage keys
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            try {
              const stored = window.localStorage.getItem(key);
              if (stored) {
                const pendingAuth = JSON.parse(stored) as PendingAuth;
                // Check if expired
                if (now - pendingAuth.initiatedAt > fiveMinutes) {
                  keysToRemove.push(key);
                }
              }
            } catch (error) {
              // Invalid JSON, remove it
              keysToRemove.push(key);
            }
          }
        }

        // Remove expired entries
        keysToRemove.forEach(key => window.localStorage.removeItem(key));
      } catch (error) {
        console.error('Failed to cleanup expired pending auths:', error);
      }
    }
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
    // Construct URL: {apiBaseUrl}{oauthApiBase}/authorize
    // If apiBaseUrl is not set, use relative URL (same origin)
    const url = this.apiBaseUrl 
      ? `${this.apiBaseUrl}${this.oauthApiBase}/authorize`
      : `${this.oauthApiBase}/authorize`;

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
    // Construct URL: {apiBaseUrl}{oauthApiBase}/callback
    // If apiBaseUrl is not set, use relative URL (same origin)
    const url = this.apiBaseUrl 
      ? `${this.apiBaseUrl}${this.oauthApiBase}/callback`
      : `${this.oauthApiBase}/callback`;

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

