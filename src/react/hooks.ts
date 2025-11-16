/**
 * React hooks for integrate-sdk
 * 
 * Provides React hooks for managing provider tokens in client-side applications.
 */

import { useState, useEffect } from "react";
import type { MCPClient } from "../client.js";

/**
 * Return type for useIntegrateTokens hook
 */
export interface UseIntegrateTokensResult {
  /**
   * Current provider tokens (e.g., { github: 'token123', gmail: 'token456' })
   */
  tokens: Record<string, string>;

  /**
   * Whether tokens are currently being loaded
   */
  isLoading: boolean;
}

/**
 * Safe fallback result for SSR or when client is not ready
 * @internal
 */
function getSafeFallback(): UseIntegrateTokensResult {
  return {
    tokens: {},
    isLoading: false,
  };
}

/**
 * Check if we're in a valid React rendering context where hooks can be called
 * @internal
 */
function isReactHooksAvailable(): boolean {
  // Check 1: React hooks functions exist
  if (!useState || !useEffect) {
    return false;
  }

  // Check 2: We're in a browser environment (not SSR)
  if (typeof window === 'undefined') {
    return false;
  }

  // Check 3: Document exists (ensures we're past the initial module loading phase)
  if (typeof document === 'undefined') {
    return false;
  }

  return true;
}

/**
 * React hook to access integrate-sdk provider token status
 * 
 * Automatically listens for authentication events and updates when tokens change.
 * Use this hook to display connection status in your UI.
 * 
 * **For automatic token injection**, use `useIntegrateAI()` instead.
 * 
 * **Note:** This hook must be called inside a React component. It will return safe
 * fallback values during SSR or if the client is not ready.
 * 
 * @param client - MCP client instance created with createMCPClient() (optional)
 * @returns Object with tokens and loading state
 * 
 * @example
 * ```tsx
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { useIntegrateTokens } from 'integrate-sdk/react';
 * 
 * const client = createMCPClient({
 *   integrations: [githubIntegration({ clientId: '...' })],
 * });
 * 
 * function ConnectionStatus() {
 *   const { tokens, isLoading } = useIntegrateTokens(client);
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   return (
 *     <div>
 *       {Object.keys(tokens).length > 0 ? (
 *         <span>Connected: {Object.keys(tokens).join(', ')}</span>
 *       ) : (
 *         <span>Not connected</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIntegrateTokens(
  client?: MCPClient<any> | null
): UseIntegrateTokensResult {
  // Guard 1: Check if React hooks are available
  // This handles SSR, Suspense boundaries, and initialization timing issues
  if (!isReactHooksAvailable()) {
    console.warn(
      '[useIntegrateTokens] React hooks are not available. ' +
      'This can happen during SSR, before React initialization, or in Suspense boundaries. ' +
      'Returning safe fallback values.'
    );
    return getSafeFallback();
  }

  // Guard 2: Check if client is ready
  // If client is null/undefined, return fallback with loading state
  if (!client) {
    return {
      ...getSafeFallback(),
      isLoading: true, // Indicate that we're waiting for client
    };
  }

  // Now safe to use React hooks (we've verified React is available)
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      // Get initial tokens
      const updateTokens = () => {
        try {
          const currentTokens = client.getAllProviderTokens();
          setTokens(currentTokens);
          setIsLoading(false);
        } catch (error) {
          console.error('[useIntegrateTokens] Failed to get provider tokens:', error);
          setIsLoading(false);
        }
      };

      // Initial load
      updateTokens();

      // Listen for auth events
      const handleAuthComplete = () => {
        updateTokens();
      };

      const handleAuthDisconnect = () => {
        updateTokens();
      };

      const handleAuthLogout = () => {
        setTokens({});
      };

      client.on('auth:complete', handleAuthComplete);
      client.on('auth:disconnect', handleAuthDisconnect);
      client.on('auth:logout', handleAuthLogout);

      // Cleanup
      return () => {
        client.off('auth:complete', handleAuthComplete);
        client.off('auth:disconnect', handleAuthDisconnect);
        client.off('auth:logout', handleAuthLogout);
      };
    } catch (error) {
      console.error('[useIntegrateTokens] Error setting up hook:', error);
      setIsLoading(false);
      return;
    }
  }, [client]);

  return {
    tokens,
    isLoading,
  };
}

/**
 * Options for useIntegrateAI hook
 */
export interface UseIntegrateAIOptions {
  /**
   * URL pattern to intercept for token injection
   * Default: /\/api\/chat/
   * Can be a string (uses .includes()) or RegExp
   */
  apiPattern?: string | RegExp;

  /**
   * Enable debug logging
   * Default: false
   */
  debug?: boolean;
}

/**
 * Global fetch interceptor for Vercel AI SDK
 * 
 * Automatically injects integrate provider tokens into all AI SDK requests.
 * Call this once at your app root (layout/provider) to enable automatic token
 * injection for all `useChat` calls in your application.
 * 
 * **Note:** This installs a global `window.fetch` interceptor that only affects
 * requests matching the `apiPattern`. All other requests pass through unchanged.
 * 
 * @param client - MCP client instance created with createMCPClient() (optional)
 * @param options - Configuration options for the interceptor
 * 
 * @example
 * ```tsx
 * // app/layout.tsx or app/providers.tsx
 * 'use client';
 * 
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { useIntegrateAI } from 'integrate-sdk/react';
 * 
 * const client = createMCPClient({
 *   integrations: [
 *     githubIntegration({ clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID }),
 *   ],
 * });
 * 
 * export function Providers({ children }) {
 *   // Install global interceptor once
 *   useIntegrateAI(client);
 *   
 *   return <>{children}</>;
 * }
 * 
 * // Now any component can use useChat without manual token management
 * function ChatPage() {
 *   const chat = useChat(); // ✅ Tokens automatically included!
 *   return <div>...</div>;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With custom API pattern and debug logging
 * useIntegrateAI(client, {
 *   apiPattern: /\/(api|chat)\//, // Match /api/ or /chat/
 *   debug: true, // Log intercepted requests
 * });
 * ```
 */
export function useIntegrateAI(
  client?: MCPClient<any> | null,
  options: UseIntegrateAIOptions = {}
): void {
  const { apiPattern = /\/api\/chat/, debug = false } = options;

  useEffect(() => {
    // Skip if no client or not in browser
    if (!client || typeof window === 'undefined') {
      if (debug && !client) {
        console.warn('[useIntegrateAI] No client provided, skipping interceptor setup');
      }
      return;
    }

    // Store original fetch
    const originalFetch = window.fetch;

    // Get initial tokens
    let currentTokens: Record<string, string> = {};
    try {
      currentTokens = client.getAllProviderTokens();
      if (debug) {
        console.log('[useIntegrateAI] Initial tokens loaded:', Object.keys(currentTokens));
      }
    } catch (error) {
      console.error('[useIntegrateAI] Failed to get initial tokens:', error);
    }

    // Update tokens on auth events
    const updateTokens = () => {
      try {
        currentTokens = client.getAllProviderTokens();
        if (debug) {
          console.log('[useIntegrateAI] Tokens updated:', Object.keys(currentTokens));
        }
      } catch (error) {
        console.error('[useIntegrateAI] Failed to update tokens:', error);
      }
    };

    const handleLogout = () => {
      currentTokens = {};
      if (debug) {
        console.log('[useIntegrateAI] Tokens cleared (logout)');
      }
    };

    // Register event listeners
    client.on('auth:complete', updateTokens);
    client.on('auth:disconnect', updateTokens);
    client.on('auth:logout', handleLogout);

    // Install global fetch interceptor
    const interceptedFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      // Get URL string from various input types
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      // Check if this request matches the API pattern
      const shouldIntercept =
        typeof apiPattern === 'string'
          ? url.includes(apiPattern)
          : apiPattern.test(url);

      if (shouldIntercept && Object.keys(currentTokens).length > 0) {
        if (debug) {
          console.log('[useIntegrateAI] Intercepting request to:', url);
          console.log('[useIntegrateAI] Injecting tokens:', Object.keys(currentTokens));
        }

        // Clone init and add tokens header
        const headers = new Headers(init?.headers);
        headers.set('x-integrate-tokens', JSON.stringify(currentTokens));

        return originalFetch(input, {
          ...init,
          headers,
        });
      }

      // Pass through other requests unchanged
      return originalFetch(input, init);
    };

    // Assign the intercepted fetch
    window.fetch = interceptedFetch as typeof window.fetch;

    if (debug) {
      console.log('[useIntegrateAI] Global fetch interceptor installed');
      console.log('[useIntegrateAI] Pattern:', apiPattern);
    }

    // Cleanup: restore original fetch and remove listeners
    return () => {
      window.fetch = originalFetch;
      client.off('auth:complete', updateTokens);
      client.off('auth:disconnect', updateTokens);
      client.off('auth:logout', handleLogout);

      if (debug) {
        console.log('[useIntegrateAI] Global fetch interceptor removed');
      }
    };
  }, [client, apiPattern, debug]);
}

