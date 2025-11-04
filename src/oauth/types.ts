/**
 * OAuth Flow Types
 * Type definitions for OAuth 2.0 Authorization Code Flow with PKCE
 */

/**
 * Popup window options for OAuth flow
 */
export interface PopupOptions {
  /** Window width in pixels (default: 600) */
  width?: number;
  /** Window height in pixels (default: 700) */
  height?: number;
}

/**
 * OAuth flow configuration
 */
export interface OAuthFlowConfig {
  /** How to display OAuth authorization */
  mode: 'popup' | 'redirect';
  /** Popup window dimensions (only for popup mode) */
  popupOptions?: PopupOptions;
  /** Custom callback handler for receiving auth code */
  onAuthCallback?: (provider: string, code: string, state: string) => Promise<void>;
}

/**
 * Authorization status for a provider
 */
export interface AuthStatus {
  /** Whether the provider is authorized */
  authorized: boolean;
  /** The provider name */
  provider: string;
  /** Authorized scopes */
  scopes?: string[];
  /** Token expiration time */
  expiresAt?: string;
}

/**
 * Pending OAuth authorization
 * Tracks in-progress OAuth flows
 */
export interface PendingAuth {
  /** OAuth provider (github, gmail, etc.) */
  provider: string;
  /** CSRF protection state */
  state: string;
  /** PKCE code verifier */
  codeVerifier: string;
  /** PKCE code challenge */
  codeChallenge: string;
  /** OAuth scopes being requested */
  scopes: string[];
  /** Redirect URI */
  redirectUri?: string;
  /** Timestamp when auth was initiated */
  initiatedAt: number;
}

/**
 * OAuth authorization URL response from server
 */
export interface AuthorizationUrlResponse {
  /** The full authorization URL to redirect user to */
  authorizationUrl: string;
}

/**
 * OAuth callback response from server
 * Contains session token after successful authorization
 */
export interface OAuthCallbackResponse {
  /** Session token for authenticated requests */
  sessionToken: string;
  /** Token expiration time */
  expiresAt?: string;
}

/**
 * Parameters for OAuth callback
 */
export interface OAuthCallbackParams {
  /** Authorization code from OAuth provider */
  code: string;
  /** State parameter for CSRF protection */
  state: string;
}

/**
 * Event payload for auth:started event
 */
export interface AuthStartedEvent {
  /** Provider being authorized */
  provider: string;
}

/**
 * Event payload for auth:complete event
 */
export interface AuthCompleteEvent {
  /** Provider that was authorized */
  provider: string;
  /** Session token for authenticated requests */
  sessionToken: string;
}

/**
 * Event payload for auth:error event
 */
export interface AuthErrorEvent {
  /** Provider that failed authorization */
  provider: string;
  /** Error that occurred */
  error: Error;
}

/**
 * All possible OAuth event types
 */
export type OAuthEventType = 'auth:started' | 'auth:complete' | 'auth:error';

/**
 * Event handler function type
 */
export type OAuthEventHandler<T = any> = (payload: T) => void;

