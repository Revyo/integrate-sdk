/**
 * Server-Side Vercel AI SDK Integration Example
 * 
 * This example demonstrates how to use the Integrate SDK with Vercel's AI SDK
 * on the server side (e.g., in Next.js API routes or serverless functions).
 * 
 * Flow:
 * 1. Client authenticates with OAuth and gets tokens (stored in localStorage)
 * 2. Client sends tokens to server in request headers
 * 3. Server creates MCP client and passes tokens to getVercelAITools()
 * 4. AI model uses tools with user's authentication
 */

import { createMCPServer, githubPlugin, gmailPlugin } from "../src/server.js";
import { getVercelAITools } from "../src/integrations/vercel-ai.js";

/**
 * Example 1: Next.js API Route for AI Text Generation
 * File: app/api/ai/generate/route.ts
 */
export async function exampleNextJSAPIRoute() {
  // This would be your Next.js API route handler
  async function POST(req: Request) {
    try {
      // 1. Extract provider tokens from request headers
      // Client sends these after authenticating via OAuth
      const tokensHeader = req.headers.get('x-integrate-tokens');
      if (!tokensHeader) {
        return new Response(
          JSON.stringify({ error: 'Missing integration tokens' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const providerTokens = JSON.parse(tokensHeader);
      // providerTokens = { github: 'ghp_...', gmail: 'ya29...' }

      // 2. Parse request body
      const body = await req.json();
      const { prompt } = body;

      // 3. Create server-side MCP client
      // Note: OAuth secrets come from environment variables on the server
      const { client: serverClient } = createMCPServer({
        plugins: [
          githubPlugin({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            scopes: ['repo', 'user'],
          }),
          gmailPlugin({
            clientId: process.env.GMAIL_CLIENT_ID!,
            clientSecret: process.env.GMAIL_CLIENT_SECRET!,
            scopes: ['gmail.send', 'gmail.readonly'],
          }),
        ],
      });

      // 4. Connect the client
      await serverClient.connect();

      // 5. Get tools with user's provider tokens
      const tools = getVercelAITools(serverClient, { providerTokens });

      // 6. Use with Vercel AI SDK
      // Note: You need to install these packages:
      // bun add ai @ai-sdk/openai
      /*
      import { generateText } from 'ai';
      import { openai } from '@ai-sdk/openai';

      const result = await generateText({
        model: openai('gpt-4'),
        prompt,
        tools,
        maxToolRoundtrips: 5,
      });

      // 7. Cleanup
      await serverClient.disconnect();

      // 8. Return response
      return Response.json({
        text: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage,
      });
      */

      // For this example, we'll just return success
      await serverClient.disconnect();
      return new Response(
        JSON.stringify({ 
          message: 'Success', 
          availableTools: Object.keys(tools) 
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('API route error:', error);
      return new Response(
        JSON.stringify({ error: (error as Error).message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Simulate a request for demonstration
  console.log('Example 1: Next.js API Route - see the POST function above');
}

/**
 * Example 2: Next.js API Route with Streaming
 * File: app/api/ai/stream/route.ts
 */
export async function exampleNextJSStreamingRoute() {
  async function POST(req: Request) {
    try {
      // 1. Extract provider tokens
      const tokensHeader = req.headers.get('x-integrate-tokens');
      if (!tokensHeader) {
        return new Response('Missing integration tokens', { status: 401 });
      }

      const providerTokens = JSON.parse(tokensHeader);

      // 2. Parse request
      const body = await req.json();
      const { prompt } = body;

      // 3. Create and connect MCP client
      const { client: serverClient } = createMCPServer({
        plugins: [
          githubPlugin({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ],
      });

      await serverClient.connect();

      // 4. Get tools with tokens
      const tools = getVercelAITools(serverClient, { providerTokens });

      // 5. Stream response with Vercel AI SDK
      /*
      import { streamText } from 'ai';
      import { openai } from '@ai-sdk/openai';

      const result = await streamText({
        model: openai('gpt-4'),
        prompt,
        tools,
        maxToolRoundtrips: 5,
      });

      // Return streaming response
      return result.toAIStreamResponse();
      */

      // For demonstration
      await serverClient.disconnect();
      return new Response('Streaming example - see comments for implementation', {
        headers: { 'Content-Type': 'text/plain' }
      });
    } catch (error) {
      console.error('Streaming error:', error);
      return new Response((error as Error).message, { status: 500 });
    }
  }

  console.log('Example 2: Streaming API Route - see the POST function above');
}

/**
 * Example 3: Client-Side Code to Send Tokens
 * This shows how the client obtains and sends tokens to the server
 */
export async function exampleClientSideCode() {
  console.log('\n=== Example 3: Client-Side Token Passing ===\n');

  // Note: This would run in the browser
  /*
  import { createMCPClient, githubPlugin } from 'integrate-sdk';

  // 1. Create client and authenticate
  const client = createMCPClient({
    plugins: [
      githubPlugin({
        clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID!,
        // Note: clientSecret should NOT be on client side
        // It's only used by the server-side OAuth routes
      }),
    ],
  });

  await client.connect();

  // 2. Authorize (opens OAuth flow)
  await client.authorize('github');

  // 3. Get all provider tokens
  const providerTokens = client.getAllProviderTokens();
  // Returns: { github: 'ghp_...', gmail: 'ya29...' }

  // 4. Call your server API with tokens
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-integrate-tokens': JSON.stringify(providerTokens),
    },
    body: JSON.stringify({
      prompt: 'Create a GitHub issue titled "Server-side AI integration" in my repo'
    }),
  });

  const result = await response.json();
  console.log('AI Response:', result);
  */

  console.log('Client-side code example shown in comments above');
}

/**
 * Example 4: Complete Full-Stack Flow
 */
export async function exampleFullStackFlow() {
  console.log('\n=== Example 4: Complete Full-Stack Flow ===\n');

  console.log(`
Full-Stack Integration Flow:

1. CLIENT SETUP (browser):
   - Create MCP client with public client IDs
   - User clicks "Connect GitHub" button
   - OAuth flow opens, user authorizes
   - Token saved to localStorage

2. CLIENT REQUEST (browser):
   - User enters AI prompt
   - Client gets tokens: client.getAllProviderTokens()
   - Client sends request to server with tokens in header

3. SERVER HANDLING (Next.js API route):
   - Server receives tokens from header
   - Creates MCP server client with secrets from env
   - Passes tokens to getVercelAITools()
   - AI model uses tools with user's authentication
   - Returns response to client

4. KEY SECURITY POINTS:
   - OAuth secrets (clientSecret) NEVER sent to client
   - User tokens passed per-request (stateless)
   - Server validates tokens before use
   - Tools execute with user's permissions
  `);
}

/**
 * Example 5: Error Handling
 */
export async function exampleErrorHandling() {
  console.log('\n=== Example 5: Error Handling ===\n');

  async function POST(req: Request) {
    try {
      const tokensHeader = req.headers.get('x-integrate-tokens');
      
      // Validate tokens present
      if (!tokensHeader) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication required',
            code: 'MISSING_TOKENS',
            message: 'Please connect your integrations first'
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let providerTokens: Record<string, string>;
      try {
        providerTokens = JSON.parse(tokensHeader);
      } catch {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid token format',
            code: 'INVALID_TOKENS'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate required providers
      const body = await req.json();
      if (body.requireGithub && !providerTokens.github) {
        return new Response(
          JSON.stringify({ 
            error: 'GitHub integration required',
            code: 'MISSING_GITHUB_TOKEN',
            message: 'Please connect your GitHub account'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { client: serverClient } = createMCPServer({
        plugins: [
          githubPlugin({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ],
      });

      try {
        await serverClient.connect();
        const tools = getVercelAITools(serverClient, { providerTokens });

        // Use tools with AI...
        /*
        const result = await generateText({
          model: openai('gpt-4'),
          prompt: body.prompt,
          tools,
        });
        */

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } finally {
        // Always cleanup
        await serverClient.disconnect();
      }
    } catch (error) {
      console.error('API error:', error);
      
      // Handle specific error types
      if ((error as any).code === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Token expired',
            code: 'TOKEN_EXPIRED',
            message: 'Please reconnect your integration'
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Generic error
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          code: 'SERVER_ERROR'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  console.log('Error handling example shown in POST function above');
}

/**
 * Run all examples
 */
async function main() {
  console.log('='.repeat(60));
  console.log('SERVER-SIDE VERCEL AI SDK INTEGRATION EXAMPLES');
  console.log('='.repeat(60));

  await exampleNextJSAPIRoute();
  await exampleNextJSStreamingRoute();
  await exampleClientSideCode();
  await exampleFullStackFlow();
  await exampleErrorHandling();

  console.log('\n' + '='.repeat(60));
  console.log('IMPORTANT NOTES:');
  console.log('='.repeat(60));
  console.log(`
1. OAuth Secrets:
   - Store clientId and clientSecret in environment variables
   - NEVER expose clientSecret to the client
   - Use NEXT_PUBLIC_ prefix only for clientId on client side

2. Token Security:
   - Tokens are user-specific and grant user's permissions
   - Validate tokens on every request
   - Consider token encryption in headers for added security
   - Implement rate limiting per user

3. Connection Management:
   - Always disconnect after request completes
   - Consider connection pooling for high traffic
   - Handle connection failures gracefully

4. Required Packages:
   bun add integrate-sdk ai @ai-sdk/openai
  `);
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

