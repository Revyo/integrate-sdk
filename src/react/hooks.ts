/**
 * React hooks for integrate-sdk
 * 
 * Provides React hooks for managing provider tokens and headers
 * in client-side applications.
 */

import { useState, useEffect, useMemo } from "react";
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
}

/**
 * React hook to access integrate-sdk provider tokens and headers
 * 
 * Automatically listens for authentication events and updates when tokens change.
 * Returns tokens and formatted headers ready to pass to API requests.
 * 
 * @param client - MCP client instance created with createMCPClient()
 * @returns Object with tokens, headers, and loading state
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
 *   const { tokens, headers, isLoading } = useIntegrateTokens(client);
 *   
 *   const chat = useChat({
 *     api: '/api/chat',
 *     headers, // Automatically includes x-integrate-tokens
 *   });
 *   
 *   return <div>Chat UI here</div>;
 * }
 * ```
 * 
 * @example
 * ```tsx
 * // Manual fetch with tokens
 * import { createMCPClient } from 'integrate-sdk';
 * 
 * const client = createMCPClient({ plugins: [...] });
 * 
 * function MyComponent() {
 *   const { headers } = useIntegrateTokens(client);
 *   
 *   const fetchData = async () => {
 *     const response = await fetch('/api/data', {
 *       method: 'POST',
 *       headers: {
 *         'Content-Type': 'application/json',
 *         ...headers, // Includes x-integrate-tokens
 *       },
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
  client: MCPClient<any>
): UseIntegrateTokensResult {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Validate client parameter
    if (!client) {
      console.error(
        '[useIntegrateTokens] Client parameter is required. ' +
        'Pass your MCP client instance to this hook.'
      );
      setIsLoading(false);
      return;
    }

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
  const headers = useMemo((): Record<string, string> => {
    if (Object.keys(tokens).length === 0) {
      return {};
    }
    return {
      'x-integrate-tokens': JSON.stringify(tokens),
    };
  }, [tokens]);

  return {
    tokens,
    headers,
    isLoading,
  };
}

