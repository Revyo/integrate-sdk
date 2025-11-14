/**
 * Tests for MCP Tool Call Handler
 * Tests the handleToolCall method in base-handler.ts
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  OAuthHandler,
  type OAuthHandlerConfig,
  type ToolCallRequest,
} from "../../src/adapters/base-handler";

describe("OAuthHandler - handleToolCall", () => {
  let config: OAuthHandlerConfig;
  let handler: OAuthHandler;

  beforeEach(() => {
    config = {
      providers: {
        github: {
          clientId: "github-client-id",
          clientSecret: "github-client-secret",
        },
      },
      apiKey: "test-api-key-123",
    };
    handler = new OAuthHandler(config);
  });

  it("should forward tool call to MCP server with API key and provider token", async () => {
    const mockFetch = mock(async (url: string, options?: any) => {
      expect(url).toContain("/api/v1/mcp");
      expect(options?.method).toBe("POST");
      expect(options?.headers?.["X-API-KEY"]).toBe("test-api-key-123");
      expect(options?.headers?.["Authorization"]).toBe("Bearer github-token-123");
      expect(options?.headers?.["Content-Type"]).toBe("application/json");

      const body = JSON.parse(options?.body);
      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("github_list_own_repos");
      expect(body.params.arguments).toEqual({});

      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [
              {
                type: "text",
                text: '{"repos": [{"name": "repo1"}]}',
              },
            ],
            isError: false,
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
      arguments: {},
    };

    const result = await handler.handleToolCall(request, "Bearer github-token-123");

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("repo1");
    expect(result.isError).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should forward tool call without provider token when not provided", async () => {
    const mockFetch = mock(async (url: string, options?: any) => {
      expect(options?.headers?.["X-API-KEY"]).toBe("test-api-key-123");
      expect(options?.headers?.["Authorization"]).toBeUndefined();

      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "result" }],
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "server_tool",
      arguments: { param: "value" },
    };

    const result = await handler.handleToolCall(request, null);

    expect(result.content).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle tool call with arguments", async () => {
    const mockFetch = mock(async (url: string, options?: any) => {
      const body = JSON.parse(options?.body);
      expect(body.params.arguments).toEqual({
        owner: "octocat",
        repo: "Hello-World",
      });

      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [{ type: "text", text: "success" }],
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_get_repo",
      arguments: {
        owner: "octocat",
        repo: "Hello-World",
      },
    };

    await handler.handleToolCall(request, "Bearer token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle JSON-RPC error response", async () => {
    const mockFetch = mock(async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32603,
            message: "Internal error",
            data: { details: "Something went wrong" },
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
      arguments: {},
    };

    await expect(
      handler.handleToolCall(request, "Bearer token")
    ).rejects.toThrow("Internal error");

    const error = await handler
      .handleToolCall(request, "Bearer token")
      .catch((e) => e);

    expect((error as any).code).toBe(-32603);
    expect((error as any).data).toEqual({ details: "Something went wrong" });
  });

  it("should handle HTTP error response", async () => {
    const mockFetch = mock(async () => {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error occurred",
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
      arguments: {},
    };

    await expect(
      handler.handleToolCall(request, "Bearer token")
    ).rejects.toThrow("MCP server failed to execute tool call");
  });

  it("should work without API key when not configured", async () => {
    const configWithoutApiKey: OAuthHandlerConfig = {
      providers: {
        github: {
          clientId: "github-client-id",
          clientSecret: "github-client-secret",
        },
      },
    };
    const handlerWithoutApiKey = new OAuthHandler(configWithoutApiKey);

    const mockFetch = mock(async (url: string, options?: any) => {
      expect(options?.headers?.["X-API-KEY"]).toBeUndefined();
      expect(options?.headers?.["Authorization"]).toBe("Bearer token-123");

      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [{ type: "text", text: "result" }],
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
      arguments: {},
    };

    await handlerWithoutApiKey.handleToolCall(request, "Bearer token-123");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle empty arguments", async () => {
    const mockFetch = mock(async (url: string, options?: any) => {
      const body = JSON.parse(options?.body);
      expect(body.params.arguments).toEqual({});

      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: body.id,
          result: {
            content: [{ type: "text", text: "result" }],
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
    };

    await handler.handleToolCall(request, "Bearer token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle complex response content", async () => {
    const mockFetch = mock(async () => {
      return {
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: {
            content: [
              { type: "text", text: "text content" },
              { type: "image", data: "base64data", mimeType: "image/png" },
              { type: "resource", text: "resource content" },
            ],
            isError: false,
            structuredContent: { key: "value" },
            _meta: { timestamp: "2024-01-01" },
          },
        }),
      } as Response;
    });

    global.fetch = mockFetch as any;

    const request: ToolCallRequest = {
      name: "github_list_own_repos",
      arguments: {},
    };

    const result = await handler.handleToolCall(request, "Bearer token");

    expect(result.content).toHaveLength(3);
    expect(result.content[0].type).toBe("text");
    expect(result.content[1].type).toBe("image");
    expect(result.content[2].type).toBe("resource");
    expect(result.structuredContent).toEqual({ key: "value" });
    expect(result._meta).toEqual({ timestamp: "2024-01-01" });
  });
});

