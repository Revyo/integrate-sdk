/**
 * OAuth Window Manager
 * Handles OAuth authorization UI (popup windows and redirects)
 */

import type { PopupOptions, OAuthCallbackParams } from "./types.js";
import { safeReplaceState } from '../utils/env.js';

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * OAuth Window Manager
 * Manages popup windows and redirect flows for OAuth authorization
 * 
 * Note: This class should only be used in browser environments.
 * Server-side usage will throw errors.
 */
export class OAuthWindowManager {
  private popupWindow: Window | null = null;
  private popupCheckInterval: ReturnType<typeof setInterval> | null = null;
  private popupCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Open OAuth authorization in a popup window
   * 
   * @param url - The authorization URL to open
   * @param options - Popup window dimensions
   * @returns The opened popup window or null if blocked
   * 
   * @example
   * ```typescript
   * const manager = new OAuthWindowManager();
   * const popup = manager.openPopup(authUrl, { width: 600, height: 700 });
   * ```
   */
  openPopup(url: string, options?: PopupOptions): Window | null {
    if (!isBrowser()) {
      throw new Error('OAuthWindowManager.openPopup() can only be used in browser environments');
    }
    
    const width = options?.width || 600;
    const height = options?.height || 700;
    
    // Calculate center position
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    // Features to force popup window (not a new tab)
    const features = [
      `popup=yes`,              // Explicitly request popup (modern browsers)
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
      'copyhistory=no',
      'noopener=no',           // Keep opener reference (needed for postMessage)
    ].join(',');
    
    // Use a unique name to prevent reusing existing windows
    const windowName = `oauth_popup_${Date.now()}`;
    this.popupWindow = window.open(url, windowName, features);
    
    if (!this.popupWindow) {
      console.warn('Popup was blocked by the browser. Please allow popups for this site.');
      return null;
    }
    
    // Focus the popup
    this.popupWindow.focus();
    
    return this.popupWindow;
  }

  /**
   * Redirect current window to OAuth authorization URL
   * 
   * @param url - The authorization URL to redirect to
   * 
   * @example
   * ```typescript
   * const manager = new OAuthWindowManager();
   * manager.openRedirect(authUrl);
   * ```
   */
  openRedirect(url: string): void {
    if (!isBrowser()) {
      throw new Error('OAuthWindowManager.openRedirect() can only be used in browser environments');
    }
    
    window.location.href = url;
  }

  /**
   * Listen for OAuth callback
   * For popup: listens for postMessage from callback page
   * For redirect: parses URL parameters after redirect back
   * 
   * @param mode - The OAuth flow mode ('popup' or 'redirect')
   * @param timeoutMs - Timeout in milliseconds (default: 5 minutes)
   * @returns Promise resolving to callback parameters (code and state)
   * 
   * @example
   * ```typescript
   * // For popup flow
   * const params = await manager.listenForCallback('popup');
   * 
   * // For redirect flow (after redirect back)
   * const params = await manager.listenForCallback('redirect');
   * ```
   */
  listenForCallback(
    mode: 'popup' | 'redirect',
    timeoutMs: number = 5 * 60 * 1000
  ): Promise<OAuthCallbackParams> {
    if (mode === 'popup') {
      return this.listenForPopupCallback(timeoutMs);
    } else {
      return this.listenForRedirectCallback();
    }
  }

  /**
   * Listen for callback from popup window via postMessage
   */
  private listenForPopupCallback(timeoutMs: number): Promise<OAuthCallbackParams> {
    if (!isBrowser()) {
      return Promise.reject(new Error('OAuth popup callback can only be used in browser environments'));
    }
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error('OAuth authorization timed out'));
      }, timeoutMs);

      // Listen for postMessage from popup
      const messageHandler = (event: MessageEvent) => {
        // Validate origin (you may want to make this configurable)
        // For now, we accept any origin since the callback page is on the user's domain
        
        if (event.data && event.data.type === 'oauth_callback') {
          clearTimeout(timeout);
          
          // Clear the grace period timeout if message arrives early
          if (this.popupCheckTimeout) {
            clearTimeout(this.popupCheckTimeout);
            this.popupCheckTimeout = null;
          }
          
          window.removeEventListener('message', messageHandler);
          
          const { code, state, error } = event.data;
          
          if (error) {
            this.cleanup();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }
          
          if (!code || !state) {
            this.cleanup();
            reject(new Error('Invalid OAuth callback: missing code or state'));
            return;
          }
          
          this.cleanup();
          resolve({ code, state });
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed
      // Add a grace period (2s) before checking to avoid false positives during OAuth redirect/navigation
      this.popupCheckTimeout = setTimeout(() => {
        this.popupCheckTimeout = null; // Clear the timeout reference after it fires
        this.popupCheckInterval = setInterval(() => {
          if (this.popupWindow?.closed) {
            clearTimeout(timeout);
            clearInterval(this.popupCheckInterval!);
            window.removeEventListener('message', messageHandler);
            this.cleanup();
            reject(new Error('OAuth popup was closed by user'));
          }
        }, 500);
      }, 2000);
    });
  }

  /**
   * Parse callback parameters from current URL, hash, or sessionStorage (for redirect flow)
   */
  private listenForRedirectCallback(): Promise<OAuthCallbackParams> {
    if (!isBrowser()) {
      return Promise.reject(new Error('OAuth redirect callback can only be used in browser environments'));
    }
    
    return new Promise((resolve, reject) => {
      // First, try to get params from URL query (legacy/direct callback)
      const params = new URLSearchParams(window.location.search);
      
      let code = params.get('code');
      let state = params.get('state');
      let error = params.get('error');
      let errorDescription = params.get('error_description');
      
      // If not in URL, check hash (from redirect handler)
      if (!code && !error && window.location.hash) {
        try {
          const hash = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          const oauthCallback = hashParams.get('oauth_callback');
          
          if (oauthCallback) {
            const parsed = JSON.parse(decodeURIComponent(oauthCallback));
            code = parsed.code;
            state = parsed.state;
            
            // Clean up hash (skips in SvelteKit to avoid router conflicts)
            safeReplaceState(window.location.pathname + window.location.search);
          }
        } catch (e) {
          console.error('Failed to parse OAuth callback params from hash:', e);
        }
      }
      
      // If not in URL or hash, check sessionStorage (from callback page)
      if (!code && !error) {
        try {
          const stored = sessionStorage.getItem('oauth_callback_params');
          if (stored) {
            const parsed = JSON.parse(stored);
            code = parsed.code;
            state = parsed.state;
            // Clear after reading
            sessionStorage.removeItem('oauth_callback_params');
          }
        } catch (e) {
          console.error('Failed to parse OAuth callback params from sessionStorage:', e);
        }
      }
      
      if (error) {
        const errorMsg = errorDescription || error;
        reject(new Error(`OAuth error: ${errorMsg}`));
        return;
      }
      
      if (!code || !state) {
        reject(new Error('Invalid OAuth callback: missing code or state in URL'));
        return;
      }
      
      resolve({ code, state });
    });
  }

  /**
   * Clean up popup window and intervals
   */
  private cleanup(): void {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.close();
    }
    this.popupWindow = null;
    
    if (this.popupCheckInterval) {
      clearInterval(this.popupCheckInterval);
      this.popupCheckInterval = null;
    }
    
    if (this.popupCheckTimeout) {
      clearTimeout(this.popupCheckTimeout);
      this.popupCheckTimeout = null;
    }
  }

  /**
   * Close any open popup windows
   * Call this when aborting the OAuth flow
   */
  close(): void {
    this.cleanup();
  }
}

/**
 * Helper function to send callback data from callback page to opener window
 * Call this in your OAuth callback page
 * 
 * @param params - The callback parameters from URL
 * 
 * @example
 * ```typescript
 * // In your callback page (e.g., /oauth/callback.html)
 * import { sendCallbackToOpener } from '@integrate/sdk';
 * 
 * const params = new URLSearchParams(window.location.search);
 * sendCallbackToOpener({
 *   code: params.get('code'),
 *   state: params.get('state'),
 *   error: params.get('error')
 * });
 * ```
 */
export function sendCallbackToOpener(params: {
  code: string | null;
  state: string | null;
  error?: string | null;
}): void {
  if (!isBrowser()) {
    console.error('sendCallbackToOpener() can only be used in browser environments');
    return;
  }
  
  if (!window.opener) {
    console.error('No opener window found. This function should only be called from a popup window.');
    return;
  }
  
  // Send message to opener
  window.opener.postMessage(
    {
      type: 'oauth_callback',
      code: params.code,
      state: params.state,
      error: params.error,
    },
    '*' // In production, you should specify the exact origin
  );
  
  // Close the popup
  window.close();
}

