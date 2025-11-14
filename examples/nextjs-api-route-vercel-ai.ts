/**
 * Next.js API Route Handler Example with Vercel AI SDK
 * 
 * This example shows a complete implementation of a Next.js API route
 * that uses the Integrate SDK with Vercel AI SDK for server-side AI tool execution.
 * 
 * File structure:
 * - app/api/ai/chat/route.ts (this file)
 * - app/components/ChatInterface.tsx (client component)
 * - lib/integrate-server.ts (server-side MCP client setup)
 */

// =============================================================================
// SERVER SETUP (lib/integrate-server.ts)
// =============================================================================
// This should be in a separate file and imported by your API routes

import { createMCPServer, githubPlugin, gmailPlugin } from "../src/server.js";

// Create server-side MCP client (do this once, export and reuse)
// Plugins automatically use GITHUB_CLIENT_ID, GMAIL_CLIENT_ID, etc. from environment
export const { client: serverClient } = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  plugins: [
    githubPlugin({
      scopes: ['repo', 'user', 'read:org'],
    }),
    gmailPlugin({
      scopes: ['gmail.send', 'gmail.readonly'],
    }),
  ],
});

// =============================================================================
// API ROUTE HANDLER (app/api/ai/chat/route.ts)
// =============================================================================

import { getVercelAITools } from "../src/integrations/vercel-ai.js";
// Uncomment these imports when you have the AI SDK installed:
// import { generateText, streamText } from 'ai';
// import { openai } from '@ai-sdk/openai';

/**
 * POST handler for AI chat with tool execution
 * Supports both streaming and non-streaming responses
 */
export async function POST(req: Request) {
  try {
    // 1. Extract provider tokens from request headers
    const tokensHeader = req.headers.get('x-integrate-tokens');
    
    if (!tokensHeader) {
      return Response.json(
        { 
          error: 'Authentication required',
          message: 'Please connect your integrations first',
          code: 'MISSING_TOKENS'
        },
        { status: 401 }
      );
    }

    // 2. Parse tokens
    let providerTokens: Record<string, string>;
    try {
      providerTokens = JSON.parse(tokensHeader);
    } catch (error) {
      return Response.json(
        { 
          error: 'Invalid token format',
          code: 'INVALID_TOKENS'
        },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const { 
      messages, 
      stream = false,
      model = 'gpt-4',
      maxToolRoundtrips = 5 
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 }
      );
    }

    // 4. Get tools with user's provider tokens (auto-connects if needed)
    const tools = await getVercelAITools(serverClient, { providerTokens });

    console.log(`[AI Route] Processing request with ${Object.keys(tools).length} tools`);
    console.log(`[AI Route] Authenticated providers: ${Object.keys(providerTokens).join(', ')}`);

    // 6. Use with Vercel AI SDK
    if (stream) {
      // Streaming response
      /*
      const result = await streamText({
        model: openai(model),
        messages,
        tools,
        maxToolRoundtrips,
      });

      return result.toAIStreamResponse();
      */
      
      // For demonstration without AI SDK installed:
      return new Response(
        JSON.stringify({ 
          message: 'Streaming example - install ai package to enable',
          tools: Object.keys(tools)
        }),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'X-Available-Tools': Object.keys(tools).join(',')
          } 
        }
      );
    } else {
      // Non-streaming response
      /*
      const result = await generateText({
        model: openai(model),
        messages,
        tools,
        maxToolRoundtrips,
      });

      return Response.json({
        text: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage,
        finishReason: result.finishReason,
      });
      */

      // For demonstration without AI SDK installed:
      return Response.json({
        message: 'AI generation example - install ai package to enable',
        availableTools: Object.keys(tools),
        providersAuthenticated: Object.keys(providerTokens),
        config: {
          model,
          maxToolRoundtrips,
          stream: false,
        }
      });
    }
  } catch (error) {
    console.error('[AI Route] Error:', error);
    
    // Handle specific error types
    if ((error as any).statusCode === 401 || (error as any).code === 401) {
      return Response.json(
        { 
          error: 'Token expired',
          message: 'Please reconnect your integration',
          code: 'TOKEN_EXPIRED'
        },
        { status: 401 }
      );
    }

    // Generic error
    return Response.json(
      { 
        error: 'Internal server error',
        message: (error as Error).message,
        code: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for checking available tools
 * Useful for debugging and showing users what integrations are available
 */
export async function GET(req: Request) {
  try {
    const tokensHeader = req.headers.get('x-integrate-tokens');
    
    if (!tokensHeader) {
      return Response.json({
        authenticated: false,
        message: 'No tokens provided',
      });
    }

    const providerTokens = JSON.parse(tokensHeader);
    
    // Get tools (auto-connects if needed)
    const tools = await getVercelAITools(serverClient, { providerTokens });
    
    // Group tools by provider
    const toolsByProvider: Record<string, string[]> = {};
    for (const toolName of Object.keys(tools)) {
      const provider = toolName.split('_')[0]; // e.g., 'github_create_issue' -> 'github'
      if (!toolsByProvider[provider]) {
        toolsByProvider[provider] = [];
      }
      toolsByProvider[provider].push(toolName);
    }

    return Response.json({
      authenticated: true,
      providers: Object.keys(providerTokens),
      toolCount: Object.keys(tools).length,
      toolsByProvider,
      tools: Object.keys(tools),
    });
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// =============================================================================
// CLIENT CONFIGURATION (lib/integrate.ts)
// =============================================================================

/*
import { createMCPClient, githubPlugin, gmailPlugin } from 'integrate-sdk';

export const client = createMCPClient({
  plugins: [
    githubPlugin({
      scopes: ['repo', 'user'],
    }),
    gmailPlugin({
      scopes: ['gmail.send', 'gmail.readonly'],
    }),
  ],
  oauthFlow: { mode: 'popup' },
});
*/

// =============================================================================
// CLIENT COMPONENT (app/components/ChatInterface.tsx)
// =============================================================================

/*
'use client';

import { useState } from 'react';
import { client } from '@/lib/integrate';

export function ChatInterface() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthorize = async (provider: string) => {
    try {
      await client.authorize(provider);
      alert(`${provider} connected successfully!`);
    } catch (error: any) {
      alert(`Failed to connect ${provider}: ${error.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    try {
      // Get all provider tokens
      const providerTokens = client.getAllProviderTokens();

      // Call API route with tokens
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-integrate-tokens': JSON.stringify(providerTokens),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          stream: false,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResponse(data.text || JSON.stringify(data, null, 2));
      } else {
        setResponse(`Error: ${data.error}`);
      }
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Chat with Integrations</h1>
      
      {/* Authentication buttons *\/}
      <div className="mb-4 space-x-2">
        <button
          onClick={() => handleAuthorize('github')}
          className="px-4 py-2 bg-gray-800 text-white rounded"
        >
          Connect GitHub
        </button>
        <button
          onClick={() => handleAuthorize('gmail')}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          Connect Gmail
        </button>
      </div>

      {/* Chat interface *\/}
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask AI to use your integrations... (e.g., 'Create a GitHub issue for bug in login')"
          className="w-full p-3 border rounded"
          rows={4}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        >
          {loading ? 'Processing...' : 'Send'}
        </button>
      </form>

      {/* Response *\/}
      {response && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold mb-2">Response:</h2>
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  );
}
*/

// =============================================================================
// ENVIRONMENT VARIABLES (.env.local)
// =============================================================================

/*
# Server-side (required)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret

# Client-side (required)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
NEXT_PUBLIC_GMAIL_CLIENT_ID=your_gmail_client_id

# OpenAI API Key (required for AI functionality)
OPENAI_API_KEY=your_openai_api_key

# Optional: Custom OAuth redirect URI
OAUTH_REDIRECT_URI=https://yourdomain.com/oauth/callback
*/

// =============================================================================
// OAUTH CALLBACK ROUTE (app/api/integrate/oauth/[action]/route.ts)
// =============================================================================

/*
// This file handles OAuth callbacks
// Create this file at: app/api/integrate/oauth/[action]/route.ts

export { POST, GET } from 'integrate-sdk/server';
*/

// =============================================================================
// PACKAGE.JSON DEPENDENCIES
// =============================================================================

/*
{
  "dependencies": {
    "integrate-sdk": "latest",
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.50",
    "next": "^14.0.0",
    "react": "^18.0.0"
  }
}
*/

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

console.log(`
=============================================================================
NEXT.JS API ROUTE EXAMPLE WITH VERCEL AI SDK
=============================================================================

This example demonstrates a complete Next.js API route implementation.

SETUP:
1. Create lib/integrate-server.ts with the server client setup
2. Create app/api/ai/chat/route.ts with the POST/GET handlers
3. Create app/api/integrate/oauth/[action]/route.ts for OAuth
4. Create app/components/ChatInterface.tsx for the UI
5. Add environment variables to .env.local

FILE STRUCTURE:
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   └── chat/
│   │   │       └── route.ts (API route handler)
│   │   └── integrate/
│   │       └── oauth/
│   │           └── [action]/
│   │               └── route.ts (OAuth handler)
│   └── components/
│       └── ChatInterface.tsx (Client component)
├── lib/
│   └── integrate-server.ts (Server client setup)
└── .env.local (Environment variables)

KEY FEATURES:
✓ Server-side tool execution with user authentication
✓ Token passing from client to server
✓ Support for streaming and non-streaming responses
✓ Error handling and token validation
✓ Multi-provider support (GitHub, Gmail, etc.)
✓ Tool availability checking
✓ TypeScript types for safety

FLOW:
1. Client authenticates via OAuth (stores tokens in localStorage)
2. Client calls /api/ai/chat with tokens in header
3. Server extracts tokens and creates tools with user's auth
4. AI model uses tools with user's permissions
5. Response returned to client

SECURITY NOTES:
- OAuth secrets (clientSecret) stay on server
- User tokens passed per-request (stateless)
- Tokens validated on every request
- HTTPS required in production

For more examples, see:
- examples/vercel-ai-server-usage.ts (detailed examples)
- docs/content/docs/integrations/vercel-ai.mdx (documentation)
=============================================================================
`);

