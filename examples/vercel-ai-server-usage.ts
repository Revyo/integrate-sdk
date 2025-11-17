/**
 * Server-Side Vercel AI SDK Integration Example
 * 
 * This example demonstrates how to use the Integrate SDK with Vercel's AI SDK
 * on the server side (e.g., in Next.js API routes or serverless functions).
 * 
 * **NEW: Auto-Token Extraction** - Provider tokens are now automatically extracted
 * from request headers, eliminating manual parsing in most cases!
 * 
 * Flow:
 * 1. Client authenticates with OAuth and gets tokens (stored in localStorage)
 * 2. Client sends tokens to server in x-integrate-tokens header
 * 3. Server calls getVercelAITools() - tokens auto-extracted!
 * 4. AI model uses tools with user's authentication
 */

import { createMCPServer, githubIntegration, gmailIntegration } from "../src/server.js";
import { getVercelAITools } from "../src/ai/vercel-ai.js";

/**
 * Example 1: Next.js API Route for AI Text Generation (Auto-Extraction)
 * File: app/api/ai/generate/route.ts
 * 
 * NEW: Tokens are automatically extracted from the x-integrate-tokens header!
 */
export async function exampleNextJSAPIRoute() {
  // This would be your Next.js API route handler
  async function POST(req: Request) {
    try {
      // 1. Parse request body
      const body = await req.json();
      const { prompt } = body;

      // 2. Create server-side MCP client
      // Note: OAuth secrets come from environment variables on the server
      const { client: serverClient } = createMCPServer({
        apiKey: process.env.INTEGRATE_API_KEY,
        integrations: [
          githubIntegration({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            scopes: ['repo', 'user'],
          }),
          gmailIntegration({
            clientId: process.env.GMAIL_CLIENT_ID!,
            clientSecret: process.env.GMAIL_CLIENT_SECRET!,
            scopes: ['gmail.send', 'gmail.readonly'],
          }),
        ],
      });

      // 3. Connect the client
      await serverClient.connect();

      // 4. Get tools - tokens automatically extracted from x-integrate-tokens header!
      // No need to manually parse headers anymore
      const tools = await getVercelAITools(serverClient);

      // 5. Use with Vercel AI SDK
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

      // 6. Cleanup
      await serverClient.disconnect();

      // 7. Return response
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
          message: 'Success - Tokens auto-extracted!',
          availableTools: Object.keys(tools),
          note: 'No manual token parsing needed!'
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
 * Example 2: Next.js API Route with Streaming (Auto-Extraction)
 * File: app/api/ai/stream/route.ts
 */
export async function exampleNextJSStreamingRoute() {
  async function POST(req: Request) {
    try {
      // 1. Parse request
      const body = await req.json();
      const { prompt } = body;

      // 2. Create and connect MCP client
      const { client: serverClient } = createMCPServer({
        apiKey: process.env.INTEGRATE_API_KEY,
        integrations: [
          githubIntegration({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ],
      });

      await serverClient.connect();

      // 3. Get tools - tokens auto-extracted!
      const tools = await getVercelAITools(serverClient);

      // 4. Stream response with Vercel AI SDK
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
  import { createMCPClient, githubIntegration } from 'integrate-sdk';

  // 1. Create client and authenticate
  const client = createMCPClient({
    integrations: [
      githubIntegration({
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
   - Client sends request to server with tokens in x-integrate-tokens header

3. SERVER HANDLING (Next.js API route):
   - Server calls getVercelAITools() - tokens auto-extracted!
   - Creates MCP server client with secrets from env
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
 * Example 5: Manual Token Override (When Needed)
 * 
 * While auto-extraction works in most cases, you can still manually pass tokens
 * when needed (e.g., for custom validation or testing).
 */
export async function exampleManualOverride() {
  console.log('\n=== Example 5: Manual Token Override ===\n');

  async function POST(req: Request) {
    try {
      // Extract and validate tokens manually for custom logic
      const tokensHeader = req.headers.get('x-integrate-tokens');
      
      if (!tokensHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const providerTokens = JSON.parse(tokensHeader);
      
      // Custom validation logic
      if (!providerTokens.github) {
        return new Response(
          JSON.stringify({ error: 'GitHub required for this operation' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { client: serverClient } = createMCPServer({
        apiKey: process.env.INTEGRATE_API_KEY,
        integrations: [
          githubIntegration({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ],
      });

      try {
        await serverClient.connect();
        
        // Manually pass tokens (overrides auto-extraction)
        const tools = await getVercelAITools(serverClient, { providerTokens });

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

  console.log('Manual override example shown in POST function above');
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
  await exampleManualOverride();

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

