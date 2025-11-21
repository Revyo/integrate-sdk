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
import type { MCPContext } from "../config/types.js";
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
  private getTokenCallback?: (provider: string, context?: MCPContext) => Promise<ProviderTokenData | undefined> | ProviderTokenData | undefined;
  private setTokenCallback?: (provider: string, tokenData: ProviderTokenData, context?: MCPContext) => Promise<void> | void;
  private skipLocalStorage: boolean;

  constructor(
    oauthApiBase: string,
    flowConfig?: Partial<OAuthFlowConfig>,
    apiBaseUrl?: string,
    tokenCallbacks?: {
      getProviderToken?: (provider: string, context?: MCPContext) => Promise<ProviderTokenData | undefined> | ProviderTokenData | undefined;
      setProviderToken?: (provider: string, tokenData: ProviderTokenData, context?: MCPContext) => Promise<void> | void;
      skipLocalStorage?: boolean;
    }
  ) {
    this.oauthApiBase = oauthApiBase;
    this.apiBaseUrl = apiBaseUrl;
    this.windowManager = new OAuthWindowManager();
    this.flowConfig = {
      mode: flowConfig?.mode || 'redirect',
      popupOptions: flowConfig?.popupOptions,
      onAuthCallback: flowConfig?.onAuthCallback,
    };
    this.getTokenCallback = tokenCallbacks?.getProviderToken;
    this.setTokenCallback = tokenCallbacks?.setProviderToken;
    // Skip localStorage if explicitly requested OR if getTokenCallback is provided
    // (indicating server-side database storage is being used)
    this.skipLocalStorage = tokenCallbacks?.skipLocalStorage ?? !!tokenCallbacks?.getProviderToken;

    // Clean up any expired pending auth entries from localStorage
    this.cleanupExpiredPendingAuths();
  }

  /**
   * Initiate OAuth authorization flow
   * 
   * Note: Scopes are defined server-side in integration configuration, not passed from client.
   * 
   * @param provider - OAuth provider (github, gmail, etc.)
   * @param config - OAuth configuration (clientId/clientSecret not needed client-side)
   * @param returnUrl - Optional URL to redirect to after OAuth completion
   * @returns Promise that resolves when authorization is complete
   * 
   * @example
   * ```typescript
   * // Basic flow - scopes are defined server-side
   * await oauthManager.initiateFlow('github', {
   *   provider: 'github',
   *   scopes: [], // Ignored client-side - defined in server integration config
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
    // Note: Scopes are NOT stored client-side - they're defined server-side
    const pendingAuth: PendingAuth = {
      provider,
      state,
      codeVerifier,
      codeChallenge,
      redirectUri: config.redirectUri,
      returnUrl,
      initiatedAt: Date.now(),
    };
    this.pendingAuths.set(state, pendingAuth);

    // 3. Save to localStorage (works for both redirect and popup modes)
    // Even in popup mode, browser might convert popup to tab, so we persist as fallback
    this.savePendingAuthToStorage(state, pendingAuth);

    // 4. Request authorization URL from user's API route
    // Note: Scopes are NOT sent from client - they're defined server-side in integration config
    const authUrl = await this.getAuthorizationUrl(provider, state, codeChallenge, config.redirectUri);

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

      // 4. Save to database (via callback) or localStorage
      await this.saveProviderToken(pendingAuth.provider, tokenData);

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
   * Returns whether a token exists locally or in database (stateless check)
   * 
   * Note: This only checks if a token exists, not if it's valid.
   * Token validation happens when making actual API calls.
   * 
   * @param provider - OAuth provider to check
   * @returns Authorization status
   * 
   * @example
   * ```typescript
   * const status = await oauthManager.checkAuthStatus('github');
   * if (status.authorized) {
   *   console.log('GitHub token exists');
   * }
   * ```
   */
  async checkAuthStatus(provider: string): Promise<AuthStatus> {
    const tokenData = await this.getProviderToken(provider);

    if (!tokenData) {
      return {
        authorized: false,
        provider,
      };
    }

    // Return token status without server validation
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
   * Note: This only clears the local/in-memory token. It does not revoke the token
   * on the provider's side. For full revocation, handle that separately
   * in your application if needed.
   * 
   * @param provider - OAuth provider to disconnect
   * @returns Promise that resolves when disconnection is complete
   * 
   * @example
   * ```typescript
   * await oauthManager.disconnectProvider('github');
   * // GitHub token is now cleared from cache
   * ```
   */
  async disconnectProvider(provider: string): Promise<void> {
    const tokenData = await this.getProviderToken(provider);

    if (!tokenData) {
      throw new Error(`No access token available for provider "${provider}". Cannot disconnect provider.`);
    }

    // Clear provider token from in-memory cache
    this.providerTokens.delete(provider);
    this.clearProviderToken(provider);
  }

  /**
   * Get provider token data
   * Uses callback if provided, otherwise checks in-memory cache
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   */
  async getProviderToken(provider: string, context?: MCPContext): Promise<ProviderTokenData | undefined> {
    // If callback is provided, use it exclusively
    if (this.getTokenCallback) {
      try {
        const tokenData = await this.getTokenCallback(provider, context);
        // Update in-memory cache for performance
        if (tokenData) {
          this.providerTokens.set(provider, tokenData);
        }
        return tokenData;
      } catch (error) {
        console.error(`Failed to get token for ${provider} via callback:`, error);
        return undefined;
      }
    }
    
    // Otherwise use in-memory cache (loaded from localStorage)
    return this.providerTokens.get(provider);
  }

  /**
   * Get all provider tokens
   */
  getAllProviderTokens(): Map<string, ProviderTokenData> {
    return new Map(this.providerTokens);
  }

  /**
   * Get provider token from in-memory cache synchronously
   * Only returns cached tokens, does not call database callbacks
   * Used for immediate synchronous checks after tokens are loaded
   * @param provider - Provider name (e.g., 'github', 'gmail')
   */
  getProviderTokenFromCache(provider: string): ProviderTokenData | undefined {
    return this.providerTokens.get(provider);
  }

  /**
   * Set provider token (for manual token management)
   * Uses callback if provided, otherwise uses localStorage
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @param tokenData - Token data to store
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   */
  async setProviderToken(provider: string, tokenData: ProviderTokenData, context?: MCPContext): Promise<void> {
    this.providerTokens.set(provider, tokenData);
    await this.saveProviderToken(provider, tokenData, context);
  }

  /**
   * Clear specific provider token
   * Note: When using database callbacks, this only clears the in-memory cache.
   * Token deletion from database should be handled by the host application.
   */
  clearProviderToken(provider: string): void {
    this.providerTokens.delete(provider);
    
    // Only clear from localStorage if not using callbacks
    if (!this.getTokenCallback && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`integrate_token_${provider}`);
      } catch (error) {
        console.error(`Failed to clear token for ${provider} from localStorage:`, error);
      }
    }
  }

  /**
   * Clear all provider tokens
   * Note: When using database callbacks, this only clears the in-memory cache.
   * Token deletion from database should be handled by the host application.
   */
  clearAllProviderTokens(): void {
    const providers = Array.from(this.providerTokens.keys());
    this.providerTokens.clear();

    // Only clear from localStorage if not using callbacks
    if (!this.getTokenCallback && typeof window !== 'undefined' && window.localStorage) {
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
   * Save provider token to database (via callback) or localStorage
   * @param provider - Provider name (e.g., 'github', 'gmail')
   * @param tokenData - Token data to store
   * @param context - Optional user context (userId, organizationId, etc.) for multi-tenant apps
   */
  private async saveProviderToken(provider: string, tokenData: ProviderTokenData, context?: MCPContext): Promise<void> {
    // If callback is provided, use it exclusively (server-side with database)
    if (this.setTokenCallback) {
      try {
        await this.setTokenCallback(provider, tokenData, context);
      } catch (error) {
        console.error(`Failed to save token for ${provider} via callback:`, error);
        throw error;
      }
      return;
    }

    // If skipLocalStorage is enabled, don't save to localStorage
    // This happens when server-side database storage is being used
    if (this.skipLocalStorage) {
      // Token storage is handled server-side, skip localStorage
      return;
    }

    // Otherwise use localStorage (browser-only, no database callbacks)
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
   * Load provider token from database (via callback) or localStorage
   * Returns undefined if not found or invalid
   */
  private async loadProviderToken(provider: string): Promise<ProviderTokenData | undefined> {
    // If callback is provided, use it exclusively
    if (this.getTokenCallback) {
      try {
        return await this.getTokenCallback(provider);
      } catch (error) {
        console.error(`Failed to load token for ${provider} via callback:`, error);
        return undefined;
      }
    }

    // Otherwise use localStorage
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
   * Load all provider tokens from database (via callback) or localStorage on initialization
   */
  async loadAllProviderTokens(providers: string[]): Promise<void> {
    for (const provider of providers) {
      const tokenData = await this.loadProviderToken(provider);
      if (tokenData) {
        this.providerTokens.set(provider, tokenData);
      }
    }
  }

  /**
   * Load provider token synchronously from localStorage only
   * Returns undefined if not found or if using database callbacks
   * This method is synchronous and should only be used during initialization
   * when database callbacks are NOT configured
   */
  private loadProviderTokenSync(provider: string): ProviderTokenData | undefined {
    // Only works for localStorage, not database callbacks
    if (this.getTokenCallback) {
      return undefined;
    }

    // Read from localStorage synchronously
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
   * Load all provider tokens synchronously from localStorage on initialization
   * Only works when database callbacks are NOT configured
   * This ensures tokens are available immediately for isAuthorized() calls
   */
  loadAllProviderTokensSync(providers: string[]): void {
    // Only works for localStorage, not database callbacks
    if (this.getTokenCallback) {
      return;
    }

    for (const provider of providers) {
      const tokenData = this.loadProviderTokenSync(provider);
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
   * The API route will add OAuth secrets and scopes from server config and forward to MCP server
   */
  private async getAuthorizationUrl(
    provider: string,
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
        // Scopes are NOT sent - they're defined server-side in integration configuration
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

