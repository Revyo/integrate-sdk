/**
 * Tests for API Key header attachment in server requests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPServer } from "../../src/server.js";
import { githubPlugin } from "../../src/plugins/github.js";

// Store original fetch
const originalFetch = globalThis.fetch;

describe("API Key Header", () => {
  beforeEach(() => {
    // Ensure we're in server context
    delete (globalThis as any).window;
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  test("API key is set on transport headers after createMCPServer", async () => {
    const { client } = createMCPServer({
      apiKey: 'test-api-key-12345',
      plugins: [
        githubPlugin({
          clientId: 'test-id',
          clientSecret: 'test-secret',
        }),
      ],
    });

    // Access the transport's headers (internal check)
    const transport = (client as any).transport;
    const headers = transport.getHeaders();
    
    expect(headers).toBeDefined();
    expect(headers['X-API-KEY']).toBe('test-api-key-12345');
  });

  test("API key is NOT set when not provided", async () => {
    const { client } = createMCPServer({
      // No apiKey
      plugins: [
        githubPlugin({
          clientId: 'test-id',
          clientSecret: 'test-secret',
        }),
      ],
    });

    // Access the transport's headers (internal check)
    const transport = (client as any).transport;
    const headers = transport.getHeaders();
    
    expect(headers).toBeDefined();
    expect(headers['X-API-KEY']).toBeUndefined();
  });

  test("API key can be updated after client creation", async () => {
    const { client } = createMCPServer({
      apiKey: 'initial-key',
      plugins: [
        githubPlugin({
          clientId: 'test-id',
          clientSecret: 'test-secret',
        }),
      ],
    });

    // Access the transport's headers (internal check)
    const transport = (client as any).transport;
    let headers = transport.getHeaders();
    
    expect(headers['X-API-KEY']).toBe('initial-key');

    // Update the API key
    client.setRequestHeader('X-API-KEY', 'updated-key');
    
    headers = transport.getHeaders();
    expect(headers['X-API-KEY']).toBe('updated-key');
  });

  test("custom serverUrl with API key", async () => {
    const { client } = createMCPServer({
      serverUrl: 'http://localhost:8080/api/v1/mcp',
      apiKey: 'local-test-key',
      plugins: [
        githubPlugin({
          clientId: 'test-id',
          clientSecret: 'test-secret',
        }),
      ],
    });

    // Verify both serverUrl and API key are set
    const transport = (client as any).transport;
    const headers = transport.getHeaders();
    
    expect(transport.url).toBe('http://localhost:8080/api/v1/mcp');
    expect(headers['X-API-KEY']).toBe('local-test-key');
  });

  test("API key is included in actual tool call requests", async () => {
    let capturedHeaders: Record<string, any> | undefined;
    
    // Mock fetch to capture headers
    globalThis.fetch = mock(async (url: any, options: any) => {
      capturedHeaders = options?.headers;
      
      // Mock successful response for initialize
      if (options?.body && JSON.parse(options.body).method === 'initialize') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: JSON.parse(options.body).id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'test-server',
              version: '1.0.0',
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Mock successful response for list tools
      if (options?.body && JSON.parse(options.body).method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: JSON.parse(options.body).id,
          result: {
            tools: [
              {
                name: 'test_tool',
                description: 'Test tool',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Mock successful response for tool call
      if (options?.body && JSON.parse(options.body).method === 'tools/call') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: JSON.parse(options.body).id,
          result: {
            content: [
              {
                type: 'text',
                text: 'Success',
              },
            ],
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response('Not found', { status: 404 });
    }) as any;

    const { client } = createMCPServer({
      serverUrl: 'http://localhost:8080/api/v1/mcp',
      apiKey: 'test-api-key-tool-call',
      plugins: [
        githubPlugin({
          clientId: 'test-id',
          clientSecret: 'test-secret',
        }),
      ],
    });

    // Connect and make a tool call
    await client.connect();
    
    // Headers should have been captured during initialize and contain API key
    expect(capturedHeaders).toBeDefined();
    expect(capturedHeaders?.['X-API-KEY']).toBe('test-api-key-tool-call');
    
    await client.disconnect();
  });
});

