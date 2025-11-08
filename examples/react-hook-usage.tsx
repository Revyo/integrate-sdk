/**
 * React Hook Usage Example
 * 
 * This example shows how to use the useIntegrateTokens() hook
 * with Vercel AI SDK's useChat hook for seamless integration.
 * 
 * ⚠️ IMPORTANT - Next.js App Router / SSR Users:
 * 
 * The useIntegrateTokens() hook is SSR-SAFE and automatically handles
 * server-side rendering by returning safe fallback values. You can call
 * it in any client component without worrying about "Invalid hook call" errors.
 * 
 * Key features:
 * - Returns safe fallbacks during SSR (isLoading=false, no tokens)
 * - Handles null/undefined client gracefully
 * - Must be called unconditionally at component top level (standard React rule)
 * - Works with Next.js App Router's 'use client' directive
 * 
 * For Next.js App Router, make sure to:
 * 1. Add 'use client' directive to your component file
 * 2. Call useIntegrateTokens() unconditionally at the top of your component
 * 3. The hook will handle the rest (SSR safety, token loading, etc.)
 */

import { createMCPClient, githubPlugin, gmailPlugin } from "../src/index.js";
import { useIntegrateTokens } from "../react.js";
// In a real app, you'd import from 'ai/react'
// import { useChat } from 'ai/react';

/**
 * Step 1: Create the MCP client outside of your component
 * This should be done at the module level, not inside a component
 */
const client = createMCPClient({
  plugins: [
    githubPlugin({
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "your-client-id",
    }),
    gmailPlugin({
      clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID || "your-client-id",
    }),
  ],
});

/**
 * Example 1a: Using custom fetch with Vercel AI SDK's useChat (RECOMMENDED)
 * 
 * ⚠️ For Next.js App Router: Add 'use client' directive to this file
 * 
 * The hook is SSR-safe and will return safe fallbacks during server-side
 * rendering. Always call it unconditionally at the top of your component.
 */
export function ChatComponentWithFetch() {
  // ✅ Hook called unconditionally at top level - SSR-safe
  // During SSR: returns { fetch: globalThis.fetch, isLoading: false, tokens: {}, ... }
  // On client: returns actual tokens and custom fetch
  const { fetch: fetchWithTokens, isLoading } = useIntegrateTokens(client);

  // Pass the custom fetch to useChat - tokens are included automatically!
  // const chat = useChat({
  //   api: '/api/chat',
  //   fetch: fetchWithTokens, // ✅ Tokens automatically included
  // });

  return (
    <div>
      <h1>AI Chat with Integrations (Custom Fetch)</h1>
      
      {isLoading ? (
        <p>Loading tokens...</p>
      ) : (
        <div>
          <p>✅ Tokens loaded and ready</p>
          {/* Your chat UI here */}
        </div>
      )}
    </div>
  );
}

/**
 * Example 1b: Using headers (backward compatible)
 */
export function ChatComponentWithHeaders() {
  // Get tokens and formatted headers from the hook
  const { tokens, headers, isLoading } = useIntegrateTokens(client);

  // Pass headers to useChat - they will be sent with every request
  // const chat = useChat({
  //   api: '/api/chat',
  //   headers, // Includes x-integrate-tokens header automatically
  // });

  // Example of what the headers look like:
  // { "x-integrate-tokens": "{\"github\":\"ghp_...\",\"gmail\":\"ya29...\"}" }

  return (
    <div>
      <h1>AI Chat with Integrations (Headers)</h1>
      
      {isLoading ? (
        <p>Loading tokens...</p>
      ) : (
        <div>
          <p>Connected providers: {Object.keys(tokens).join(", ")}</p>
          
          {/* Your chat UI here */}
          {/* <div>
            {chat.messages.map(message => (
              <div key={message.id}>{message.content}</div>
            ))}
          </div> */}
        </div>
      )}
    </div>
  );
}

/**
 * Example 2a: Manual fetch with custom fetch function (RECOMMENDED)
 */
export function ManualFetchWithCustomFetch() {
  const { fetch: fetchWithTokens } = useIntegrateTokens(client);

  const handleFetch = async () => {
    // Just use fetchWithTokens like regular fetch - tokens are included automatically!
    const response = await fetchWithTokens('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Get my GitHub repositories',
      }),
    });

    const data = await response.json();
    console.log('Response:', data);
  };

  return (
    <button onClick={handleFetch}>
      Fetch Data (Custom Fetch)
    </button>
  );
}

/**
 * Example 2b: Manual fetch with mergeHeaders helper
 */
export function ManualFetchWithMergeHeaders() {
  const { mergeHeaders } = useIntegrateTokens(client);

  const handleFetch = async () => {
    // Use mergeHeaders to combine your headers with integrate tokens
    const response = await fetch('/api/data', {
      method: 'POST',
      headers: mergeHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        query: 'Get my GitHub repositories',
      }),
    });

    const data = await response.json();
    console.log('Response:', data);
  };

  return (
    <button onClick={handleFetch}>
      Fetch Data (Merge Headers)
    </button>
  );
}

/**
 * Example 2c: Manual fetch with headers spreading (backward compatible)
 */
export function ManualFetchWithSpreadHeaders() {
  const { headers } = useIntegrateTokens(client);

  const handleFetch = async () => {
    const response = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers, // Spread headers to include x-integrate-tokens
      },
      body: JSON.stringify({
        query: 'Get my GitHub repositories',
      }),
    });

    const data = await response.json();
    console.log('Response:', data);
  };

  return (
    <button onClick={handleFetch}>
      Fetch Data (Spread Headers)
    </button>
  );
}

/**
 * Example 3: Monitoring token changes
 */
export function TokenMonitor() {
  const { tokens, isLoading } = useIntegrateTokens(client);

  // The hook automatically updates when auth events occur:
  // - When user authorizes a provider (auth:complete)
  // - When user disconnects a provider (auth:disconnect)
  // - When user logs out (auth:logout)

  return (
    <div>
      <h2>Token Status</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {Object.entries(tokens).map(([provider, token]) => (
            <li key={provider}>
              {provider}: {token ? '✓ Connected' : '✗ Not connected'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Example 4: Complete application with auth flow (using custom fetch)
 */
export function CompleteExample() {
  const { tokens, fetch: fetchWithTokens, isLoading } = useIntegrateTokens(client);

  const handleConnectGitHub = async () => {
    try {
      await client.authorize('github');
      // Hook will automatically update tokens after auth completes
    } catch (error) {
      console.error('Failed to connect GitHub:', error);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await client.disconnectProvider('github');
      // Hook will automatically update tokens after disconnect
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
    }
  };

  // const chat = useChat({
  //   api: '/api/chat',
  //   fetch: fetchWithTokens, // Use custom fetch - cleaner and more reliable!
  // });

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Chat with GitHub Integration</h1>
      
      {/* Connection status */}
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">Connection Status</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {tokens.github ? (
              <div className="flex items-center justify-between">
                <span>✓ GitHub Connected</span>
                <button
                  onClick={handleDisconnectGitHub}
                  className="px-3 py-1 bg-red-500 text-white rounded"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span>✗ GitHub Not Connected</span>
                <button
                  onClick={handleConnectGitHub}
                  className="px-3 py-1 bg-gray-800 text-white rounded"
                >
                  Connect GitHub
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat interface */}
      {/* <div className="space-y-4">
        <div className="space-y-2">
          {chat.messages.map(message => (
            <div
              key={message.id}
              className={`p-3 rounded ${
                message.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
        
        <form onSubmit={chat.handleSubmit} className="flex gap-2">
          <input
            value={chat.input}
            onChange={chat.handleInputChange}
            placeholder="Ask AI to use GitHub..."
            className="flex-1 p-2 border rounded"
          />
          <button
            type="submit"
            disabled={chat.isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            Send
          </button>
        </form>
      </div> */}
    </div>
  );
}

/**
 * Example 5: Using with multiple clients (advanced)
 */
const clientA = createMCPClient({
  singleton: false, // Disable singleton to create separate instance
  plugins: [githubPlugin({ clientId: "client-a" })],
});

const clientB = createMCPClient({
  singleton: false,
  plugins: [gmailPlugin({ clientId: "client-b" })],
});

export function MultiClientExample() {
  const githubTokens = useIntegrateTokens(clientA);
  const gmailTokens = useIntegrateTokens(clientB);

  return (
    <div>
      <div>
        <h3>GitHub Client</h3>
        <p>Tokens: {Object.keys(githubTokens.tokens).join(", ")}</p>
      </div>
      <div>
        <h3>Gmail Client</h3>
        <p>Tokens: {Object.keys(gmailTokens.tokens).join(", ")}</p>
      </div>
    </div>
  );
}

/**
 * Example 6: Next.js App Router with 'use client' (SSR-SAFE)
 * 
 * This demonstrates proper usage in Next.js App Router.
 * The hook handles SSR gracefully without "Invalid hook call" errors.
 */
'use client'; // Required for Next.js App Router

import { useState } from 'react';

export function NextJsAppRouterExample() {
  // ✅ Hook is SSR-safe - works during both server and client rendering
  // On server: returns safe fallbacks { fetch: globalThis.fetch, tokens: {}, isLoading: false }
  // On client: returns actual tokens and custom fetch
  const { fetch: fetchWithTokens, tokens, isLoading } = useIntegrateTokens(client);
  const [response, setResponse] = useState<string>('');

  const handleSend = async () => {
    // fetchWithTokens is safe to call immediately - includes tokens automatically
    const res = await fetchWithTokens('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello from Next.js!' }),
    });
    const data = await res.json();
    setResponse(data.message);
  };

  return (
    <div>
      <h2>Next.js App Router Example</h2>
      <p>Connected: {Object.keys(tokens).join(', ') || 'None'}</p>
      {isLoading && <p>Loading tokens...</p>}
      <button onClick={handleSend}>Send Message</button>
      {response && <p>Response: {response}</p>}
    </div>
  );
}

/**
 * Example 7: Handling null/undefined client (lazy initialization)
 * 
 * The hook gracefully handles null/undefined clients by returning
 * safe fallbacks with isLoading=true until the client is ready.
 */
'use client';

import { useEffect } from 'react';

export function LazyClientExample() {
  const [lazyClient, setLazyClient] = useState<ReturnType<typeof createMCPClient> | null>(null);

  // ✅ Hook handles null client - returns safe fallback with isLoading=true
  const { fetch: fetchWithTokens, tokens, isLoading } = useIntegrateTokens(lazyClient);

  useEffect(() => {
    // Initialize client lazily (e.g., after user action or condition)
    const initClient = async () => {
      const newClient = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '',
            scopes: ['repo'],
          }),
        ],
      });
      setLazyClient(newClient);
    };

    initClient();
  }, []);

  if (!lazyClient || isLoading) {
    return <div>Initializing client...</div>;
  }

  return (
    <div>
      <h2>Lazy Client Example</h2>
      <p>Tokens: {Object.keys(tokens).join(', ')}</p>
      <button onClick={() => fetchWithTokens('/api/test')}>
        Make Request
      </button>
    </div>
  );
}

// =============================================================================
// SERVER-SIDE API ROUTE
// =============================================================================

/**
 * Example API route that receives and uses the tokens
 * 
 * File: app/api/chat/route.ts
 */
export const serverRouteExample = `
import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
import { getVercelAITools } from 'integrate-sdk';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { client: serverClient } = createMCPServer({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});

export async function POST(req: Request) {
  // Extract tokens from headers (sent by useIntegrateTokens hook)
  const tokensHeader = req.headers.get('x-integrate-tokens');
  
  if (!tokensHeader) {
    return Response.json({ error: 'Missing tokens' }, { status: 401 });
  }

  const providerTokens = JSON.parse(tokensHeader);
  
  // Get tools with user's tokens
  const tools = await getVercelAITools(serverClient, { providerTokens });
  
  // Parse request
  const { messages } = await req.json();
  
  // Stream response with tools
  const result = await streamText({
    model: openai('gpt-4'),
    messages,
    tools,
  });
  
  return result.toAIStreamResponse();
}
`;

console.log(`
=============================================================================
REACT HOOK USAGE EXAMPLES
=============================================================================

This file demonstrates various ways to use the useIntegrateTokens() hook.

KEY POINTS:
1. Create MCP client outside of components (module level)
2. Pass client to useIntegrateTokens(client)
3. ✨ NEW: Use custom fetch or mergeHeaders for cleaner code
4. Hook automatically updates when tokens change

RETURN VALUES:
- tokens: Raw token object { github: 'token', gmail: 'token' }
- headers: Formatted headers { 'x-integrate-tokens': '...' }
- isLoading: Boolean indicating if tokens are being loaded
- fetch: ✨ Custom fetch with tokens automatically included
- mergeHeaders: ✨ Helper to merge headers with tokens

RECOMMENDED APPROACHES:

1. With useChat (Vercel AI SDK):
   const { fetch: fetchWithTokens } = useIntegrateTokens(client);
   const chat = useChat({ api: '/api/chat', fetch: fetchWithTokens });

2. With manual fetch:
   const { fetch: fetchWithTokens } = useIntegrateTokens(client);
   await fetchWithTokens('/api/data', { method: 'POST', ... });

3. Merging headers:
   const { mergeHeaders } = useIntegrateTokens(client);
   await fetch('/api/data', { headers: mergeHeaders({ 'Content-Type': 'application/json' }) });

MIGRATION GUIDE:

❌ OLD WAY (fragile):
   window.fetch = (url, options) => {
     // Override global fetch - not recommended!
   }

✅ NEW WAY (clean):
   const { fetch: fetchWithTokens } = useIntegrateTokens(client);
   const chat = useChat({ fetch: fetchWithTokens });

See examples above for complete implementations.
=============================================================================
`);

