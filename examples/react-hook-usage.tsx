/**
 * React Hooks Usage Examples
 * 
 * This file demonstrates how to use integrate-sdk React hooks
 * with Vercel AI SDK for seamless token management.
 */

import { createMCPClient, githubPlugin, gmailPlugin } from "../src/index.js";
import { useIntegrateAI, useIntegrateTokens } from "../react.js";
// In a real app, you'd import from 'integrate-sdk' and 'integrate-sdk/react'

/**
 * RECOMMENDED PATTERN: Global AI Interceptor
 * 
 * Use useIntegrateAI() once at your app root to automatically inject
 * tokens into all AI SDK requests. No manual token management needed!
 */

// Create MCP client (do this at module level or in a provider)
const client = createMCPClient({
  plugins: [
    githubPlugin({
      clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "your-client-id",
      scopes: ["repo", "user"],
    }),
    gmailPlugin({
      clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID || "your-client-id",
    }),
  ],
});

/**
 * Example 1: App Root / Layout (REQUIRED)
 * 
 * Call useIntegrateAI() once at your app root to install the global interceptor.
 * This makes ALL useChat calls automatically include tokens.
 */
'use client';

import { useChat } from '@ai-sdk/react';

export function RootLayout({ children }: { children: React.ReactNode }) {
  // ✅ Install global fetch interceptor once
  // This affects all API calls matching /api/chat in your entire app
  useIntegrateAI(client);
  
  return <>{children}</>;
}

/**
 * Example 2: Chat Page (SIMPLE!)
 * 
 * Now any component can use useChat without worrying about tokens.
 * The global interceptor handles everything automatically.
 */
export function ChatPage() {
  // ✅ No need to pass custom fetch or headers!
  // Tokens are automatically injected by useIntegrateAI
  const chat = useChat();

  return (
    <div>
      <div>
        {chat.messages.map((message) => (
          <div key={message.id}>
            <strong>{message.role}:</strong> {message.content}
          </div>
        ))}
      </div>
      
      <form onSubmit={chat.handleSubmit}>
        <input
          value={chat.input}
          onChange={chat.handleInputChange}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={chat.isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}

/**
 * Example 3: Connection Status Display
 * 
 * Use useIntegrateTokens() to display which providers are connected.
 * This hook only returns tokens and isLoading for UI purposes.
 */
export function ConnectionStatus() {
  const { tokens, isLoading } = useIntegrateTokens(client);

  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }

  const connectedProviders = Object.keys(tokens);

  return (
    <div>
      {connectedProviders.length > 0 ? (
        <div>
          <strong>Connected:</strong> {connectedProviders.join(', ')}
        </div>
      ) : (
        <div>
          <em>No providers connected</em>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Authentication Buttons + Status
 * 
 * Complete example showing auth buttons and connection status together.
 */
export function AuthenticatedChat() {
  const { tokens, isLoading } = useIntegrateTokens(client);
  const chat = useChat(); // ✅ Tokens auto-injected by useIntegrateAI

  const handleConnectGitHub = async () => {
    try {
      await client.authorize('github');
    } catch (error) {
      console.error('GitHub auth failed:', error);
    }
  };

  const handleConnectGmail = async () => {
    try {
      await client.authorize('gmail');
    } catch (error) {
      console.error('Gmail auth failed:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1>AI Chat with GitHub & Gmail</h1>

      {/* Connection Status */}
      <div className="mb-4 p-3 bg-gray-100 rounded">
        <h2 className="font-bold mb-2">Account Connections</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {/* GitHub */}
            {tokens.github ? (
              <div>✅ GitHub Connected</div>
            ) : (
              <button onClick={handleConnectGitHub} className="btn">
                Connect GitHub
              </button>
            )}

            {/* Gmail */}
            {tokens.gmail ? (
              <div>✅ Gmail Connected</div>
            ) : (
              <button onClick={handleConnectGmail} className="btn">
                Connect Gmail
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="space-y-4">
        <div className="space-y-2">
          {chat.messages.map((message) => (
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
            placeholder="Ask AI to use GitHub or Gmail..."
            className="flex-1 p-2 border rounded"
          />
          <button
            type="submit"
            disabled={chat.isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Example 5: Custom API Pattern
 * 
 * You can customize which URLs get token injection.
 */
export function CustomPatternExample() {
  // Intercept both /api/ and /chat/ endpoints
  useIntegrateAI(client, {
    apiPattern: /\/(api|chat)\//,
  });

  return <div>Global interceptor active for /api/ and /chat/</div>;
}

/**
 * Example 6: Debug Mode
 * 
 * Enable debug logging to see what's being intercepted.
 */
export function DebugExample() {
  useIntegrateAI(client, {
    debug: true, // Logs all intercepted requests
  });

  return <div>Check console for debug logs</div>;
}

/**
 * Example 7: Multiple Chat Components
 * 
 * All chat components automatically get tokens without any extra work.
 */
export function MultiChatExample() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ChatComponent title="Chat 1" />
      <ChatComponent title="Chat 2" />
    </div>
  );
}

function ChatComponent({ title }: { title: string }) {
  // ✅ Each useChat call automatically includes tokens
  const chat = useChat();

  return (
    <div className="border p-4 rounded">
      <h3 className="font-bold mb-2">{title}</h3>
      {/* Chat UI */}
    </div>
  );
}

/**
 * Example 8: Lazy Client Initialization
 * 
 * You can pass null/undefined to useIntegrateAI and it won't crash.
 * Useful for lazy initialization patterns.
 */
export function LazyInitExample() {
  const [mcpClient, setMcpClient] = React.useState<typeof client | null>(null);

  React.useEffect(() => {
    // Initialize client lazily
    const newClient = createMCPClient({
      plugins: [githubPlugin({ clientId: '...' })],
    });
    setMcpClient(newClient);
  }, []);

  // ✅ Safe to pass null - hook handles it gracefully
  useIntegrateAI(mcpClient);

  if (!mcpClient) {
    return <div>Initializing...</div>;
  }

  return <div>Client ready!</div>;
}

/**
 * SERVER-SIDE API ROUTE EXAMPLE
 * 
 * File: app/api/chat/route.ts
 */
export const serverRouteExample = `
import { createMCPServer, githubPlugin, gmailPlugin } from 'integrate-sdk/server';
import { getVercelAITools } from 'integrate-sdk';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const { client: serverClient } = createMCPServer({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    }),
  ],
});

export async function POST(req: Request) {
  // 1. Extract tokens from headers (sent by useIntegrateAI)
  const tokensHeader = req.headers.get('x-integrate-tokens');
  
  if (!tokensHeader) {
    return Response.json({ error: 'Missing tokens' }, { status: 401 });
  }

  // 2. Parse provider tokens
  const providerTokens = JSON.parse(tokensHeader);
  // { github: 'ghp_...', gmail: 'ya29_...' }
  
  // 3. Get tools with user's tokens
  const tools = getVercelAITools(serverClient, { providerTokens });
  
  // 4. Parse request
  const { messages } = await req.json();
  
  // 5. Stream response with tools
  const result = await streamText({
    model: openai('gpt-4'),
    messages,
    tools, // Tools will use the user's tokens!
  });
  
  return result.toDataStreamResponse();
}
`;

console.log(`
=============================================================================
REACT HOOKS USAGE - SIMPLIFIED PATTERN
=============================================================================

STEP 1: Install Global Interceptor (Once, at App Root)
-------------------------------------------------------
import { createMCPClient, githubPlugin } from 'integrate-sdk';
import { useIntegrateAI } from 'integrate-sdk/react';

const client = createMCPClient({
  plugins: [githubPlugin({ clientId: '...' })],
});

export function RootLayout({ children }) {
  useIntegrateAI(client); // ✅ That's it! One line.
  return <>{children}</>;
}

STEP 2: Use Vercel AI SDK Normally
-----------------------------------
import { useChat } from '@ai-sdk/react';

export function ChatPage() {
  const chat = useChat(); // ✅ Tokens auto-injected!
  return <div>...</div>;
}

STEP 3: Show Connection Status (Optional)
------------------------------------------
import { useIntegrateTokens } from 'integrate-sdk/react';

export function Status() {
  const { tokens, isLoading } = useIntegrateTokens(client);
  return <div>Connected: {Object.keys(tokens).join(', ')}</div>;
}

KEY BENEFITS:
-------------
✅ Zero boilerplate - one hook call at app root
✅ Works everywhere - all useChat calls automatically include tokens
✅ No manual header management - completely automatic
✅ Clean separation - useIntegrateAI for injection, useIntegrateTokens for status
✅ SSR-safe - handles server-side rendering gracefully

MIGRATION FROM OLD PATTERN:
----------------------------
OLD (Manual):
  const { fetch: fetchWithTokens } = useIntegrateTokens(client);
  const chat = useChat({ fetch: fetchWithTokens });

NEW (Automatic):
  useIntegrateAI(client); // At app root
  const chat = useChat(); // Anywhere in your app

=============================================================================
`);
