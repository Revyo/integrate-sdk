/**
 * React hooks for integrate-sdk
 * 
 * Provides React hooks for managing provider tokens and headers
 * in client-side applications.
 */

import * as React from "react";
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
   * Headers object ready to spread into fetch/useChat options
   * Includes 'x-integrate-tokens' header with JSON-stringified tokens
   */
  headers: Record<string, string>;
  
  /**
   * Whether tokens are currently being loaded
   */
  isLoading: boolean;
  
  /**
   * Custom fetch function with integrate tokens automatically included
   * Use this with libraries that accept a custom fetch function (like Vercel AI SDK's useChat)
   */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  
  /**
   * Helper function to merge integrate headers with existing headers
   * Useful for manual fetch calls where you need to combine headers
   */
  mergeHeaders: (existingHeaders?: HeadersInit) => Headers;
}

/**
 * Safe fallback result for SSR or when client is not ready
 * @internal
 */
function getSafeFallback(): UseIntegrateTokensResult {
  return {
    tokens: {},
    headers: {},
    isLoading: false,
    fetch: globalThis.fetch?.bind(globalThis) || (async () => new Response()),
    mergeHeaders: (existingHeaders?: HeadersInit) => new Headers(existingHeaders),
  };
}

/**
 * Check if we're in a valid React rendering context where hooks can be called
 * @internal
 */
function isReactHooksAvailable(): boolean {
  // Check 1: React module exists
  if (!React || typeof React !== 'object') {
    return false;
  }

  // Check 2: React hooks functions exist
  if (!React.useState || !React.useEffect || !React.useMemo || !React.useCallback) {
    return false;
  }

  // Check 3: We're in a browser environment (not SSR)
  if (typeof window === 'undefined') {
    return false;
  }

  // Check 4: Document exists (ensures we're past the initial module loading phase)
  if (typeof document === 'undefined') {
    return false;
  }

  return true;
}

/**
 * React hook to access integrate-sdk provider tokens and headers
 * 
 * Automatically listens for authentication events and updates when tokens change.
 * Returns tokens and formatted headers ready to pass to API requests.
 * 
 * **Note:** This hook must be called inside a React component. It will return safe
 * fallback values during SSR or if the client is not ready.
 * 
 * @param client - MCP client instance created with createMCPClient() (optional)
 * @returns Object with tokens, headers, loading state, fetch function, and mergeHeaders helper
 * 
 * @example
 * ```tsx
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { useIntegrateTokens } from 'integrate-sdk/react';
 * import { useChat } from 'ai/react';
 * 
 * const client = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...' })],
 * });
 * 
 * function ChatComponent() {
 *   const { fetch: fetchWithTokens, isLoading } = useIntegrateTokens(client);
 *   
 *   const chat = useChat({
 *     api: '/api/chat',
 *     fetch: fetchWithTokens, // Tokens automatically included
 *   });
 *   
 *   return <div>Chat UI here</div>;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // With mergeHeaders helper
 * import { createMCPClient } from 'integrate-sdk';
 * 
 * const client = createMCPClient({ plugins: [...] });
 * 
 * function MyComponent() {
 *   const { mergeHeaders } = useIntegrateTokens(client);
 *   
 *   const fetchData = async () => {
 *     const response = await fetch('/api/data', {
 *       method: 'POST',
 *       headers: mergeHeaders({ 'Content-Type': 'application/json' }),
 *       body: JSON.stringify({ query: 'example' }),
 *     });
 *     return response.json();
 *   };
 *   
 *   return <button onClick={fetchData}>Fetch</button>;
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
  const [tokens, setTokens] = React.useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
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

  // Memoize headers to avoid recreating on every render
  const headers = React.useMemo((): Record<string, string> => {
    if (Object.keys(tokens).length === 0) {
      return {};
    }
    return {
      'x-integrate-tokens': JSON.stringify(tokens),
    };
  }, [tokens]);

  // Custom fetch function that automatically includes integrate tokens
  const fetchWithHeaders = React.useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const mergedHeaders = new Headers(init?.headers);
      
      // Add integrate tokens header if available
      if (headers['x-integrate-tokens']) {
        mergedHeaders.set('x-integrate-tokens', headers['x-integrate-tokens']);
      }
      
      return fetch(input, {
        ...init,
        headers: mergedHeaders,
      });
    },
    [headers]
  );

  // Helper function to merge integrate headers with existing headers
  const mergeHeaders = React.useCallback(
    (existingHeaders?: HeadersInit): Headers => {
      const merged = new Headers(existingHeaders);
      
      // Add integrate tokens header if available
      if (headers['x-integrate-tokens']) {
        merged.set('x-integrate-tokens', headers['x-integrate-tokens']);
      }
      
      return merged;
    },
    [headers]
  );

  return {
    tokens,
    headers,
    isLoading,
    fetch: fetchWithHeaders,
    mergeHeaders,
  };
}

