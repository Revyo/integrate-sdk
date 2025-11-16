/**
 * Tests for Client API Routing
 * Tests that tool calls route through API handlers instead of directly to MCP server
 */

import { describe, it, expect, beforeEach, mock, afterEach } from "bun:test";
import { MCPClient, createMCPClient } from "../../src/client.js";
import { githubIntegration } from "../../src/integrations/github.js";
import { createSimpleIntegration } from "../../src/integrations/generic.js";

describe("MCP Client - API Routing", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Mock localStorage
    global.localStorage = {
      getItem: mock(() => null),
      setItem: mock(() => { }),
      removeItem: mock(() => { }),
      clear: mock(() => { }),
      length: 0,
      key: mock(() => null),
    } as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should route tool calls through API handler instead of MCP server", async () => {
    const apiRouteBase = "/api/integrate";
    let mcpServerCalled = false;
    let apiHandlerCalled = false;

    // Mock fetch for API handler and MCP server initialization
    global.fetch = mock(async (url: string, options?: any) => {
      if (url.includes("/api/integrate/mcp")) {
        apiHandlerCalled = true;
        expect(options?.method).toBe("POST");
        expect(options?.headers?.["Content-Type"]).toBe("application/json");
        expect(options?.headers?.["Authorization"]).toBe("Bearer github-token-123");

        const body = JSON.parse(options?.body);
        expect(body.name).toBe("github_list_own_repos");
        expect(body.arguments).toEqual({});

        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            content: [
              {
                type: "text",
                text: '{"repos": [{"name": "repo1"}]}',
              },
            ],
            isError: false,
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // This should NOT be called for tool calls, only for initialization
        mcpServerCalled = true;
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: {
              tools: [],
            },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    // Mock OAuth manager to return a token
    const mockOAuthManager = {
      getProviderToken: mock(() => ({
        accessToken: "github-token-123",
        expiresAt: Date.now() + 3600000,
      })),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: true })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = githubIntegration({
      clientId: "test-id",
    });

    const client = new MCPClient({
      integrations: [integration],
      apiRouteBase,
      connectionMode: "manual",
    });

    // Replace OAuth manager with mock
    (client as any).oauthManager = mockOAuthManager;

    // Mock initialization and tool discovery - set before calling ensureConnected
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("github_list_own_repos", {
      name: "github_list_own_repos",
      description: "List repos",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("github_list_own_repos");

    // Call tool through integration namespace
    const result = await (client as any).github.listOwnRepos({});

    expect(apiHandlerCalled).toBe(true);
    // MCP server might be called for initialization, but not for tool calls
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain("repo1");
  });

  it("should use default apiRouteBase when not specified", async () => {
    let apiHandlerCalled = false;

    global.fetch = mock(async (url: string) => {
      if (url.includes("/api/integrate/mcp")) {
        apiHandlerCalled = true;
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            content: [{ type: "text", text: "result" }],
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // Mock initialization calls
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    const mockOAuthManager = {
      getProviderToken: mock(() => null),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: false })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = createSimpleIntegration({
      id: "test",
      tools: ["test_tool"],
    });

    const client = new MCPClient({
      integrations: [integration],
      connectionMode: "manual",
    });

    (client as any).oauthManager = mockOAuthManager;
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("test_tool", {
      name: "test_tool",
      description: "Test tool",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("test_tool");

    // Call server tool
    await (client as any).callServerTool("test_tool", {});

    expect(apiHandlerCalled).toBe(true);
  });

  it("should include provider token in Authorization header when available", async () => {
    let authHeader: string | undefined;

    global.fetch = mock(async (url: string, options?: any) => {
      if (url.includes("/api/integrate/mcp")) {
        authHeader = options?.headers?.["Authorization"];
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            content: [{ type: "text", text: "result" }],
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // Mock initialization calls
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    const mockOAuthManager = {
      getProviderToken: mock((provider: string) => {
        if (provider === "github") {
          return {
            accessToken: "github-token-456",
            expiresAt: Date.now() + 3600000,
          };
        }
        return null;
      }),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: true })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = githubIntegration({
      clientId: "test-id",
    });

    const client = new MCPClient({
      integrations: [integration],
      apiRouteBase: "/api/integrate",
      connectionMode: "manual",
    });

    (client as any).oauthManager = mockOAuthManager;
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("github_list_own_repos", {
      name: "github_list_own_repos",
      description: "List repos",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("github_list_own_repos");

    await (client as any).github.listOwnRepos({});

    expect(authHeader).toBe("Bearer github-token-456");
  });

  it("should not include Authorization header when provider token is not available", async () => {
    let authHeader: string | undefined;

    global.fetch = mock(async (url: string, options?: any) => {
      if (url.includes("/api/integrate/mcp")) {
        authHeader = options?.headers?.["Authorization"];
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            content: [{ type: "text", text: "result" }],
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // Mock initialization calls
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    const mockOAuthManager = {
      getProviderToken: mock(() => null),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: false })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = createSimpleIntegration({
      id: "test",
      tools: ["test_tool"],
    });

    const client = new MCPClient({
      integrations: [integration],
      apiRouteBase: "/api/integrate",
      connectionMode: "manual",
    });

    (client as any).oauthManager = mockOAuthManager;
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("test_tool", {
      name: "test_tool",
      description: "Test tool",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("test_tool");

    await (client as any).callServerTool("test_tool", {});

    expect(authHeader).toBeUndefined();
  });

  it("should handle API handler errors correctly", async () => {
    global.fetch = mock(async (url: string) => {
      if (url.includes("/api/integrate/mcp")) {
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: new Headers(),
          json: async () => ({
            error: "Tool execution failed",
            code: -32603,
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // Mock initialization calls
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    const mockOAuthManager = {
      getProviderToken: mock(() => null),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: false })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = createSimpleIntegration({
      id: "test",
      tools: ["test_tool"],
    });

    const client = new MCPClient({
      integrations: [integration],
      apiRouteBase: "/api/integrate",
      connectionMode: "manual",
    });

    (client as any).oauthManager = mockOAuthManager;
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("test_tool", {
      name: "test_tool",
      description: "Test tool",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("test_tool");

    await expect((client as any).callServerTool("test_tool", {})).rejects.toThrow();
  });

  it("should use custom apiRouteBase when specified", async () => {
    let apiHandlerCalled = false;
    const customApiRouteBase = "/custom/api/mcp";

    global.fetch = mock(async (url: string) => {
      if (url.includes(customApiRouteBase)) {
        apiHandlerCalled = true;
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            content: [{ type: "text", text: "result" }],
          }),
        } as Response;
      } else if (url.includes("mcp.integrate.dev")) {
        // Mock initialization calls
        return {
          ok: true,
          headers: new Headers(),
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: { tools: [] },
          }),
        } as Response;
      }
      return { ok: false, headers: new Headers() } as Response;
    }) as any;

    const mockOAuthManager = {
      getProviderToken: mock(() => null),
      loadAllProviderTokens: mock(() => { }),
      getAllProviderTokens: mock(() => new Map()),
      setProviderToken: mock(() => { }),
      clearAllProviderTokens: mock(() => { }),
      clearAllPendingAuths: mock(() => { }),
      checkAuthStatus: mock(() => Promise.resolve({ authorized: false })),
      initiateFlow: mock(() => Promise.resolve()),
      handleCallback: mock(() => Promise.resolve({ provider: "github", accessToken: "token", expiresAt: Date.now() })),
      disconnectProvider: mock(() => Promise.resolve()),
    };

    const integration = createSimpleIntegration({
      id: "test",
      tools: ["test_tool"],
    });

    const client = new MCPClient({
      integrations: [integration],
      apiRouteBase: customApiRouteBase,
      connectionMode: "manual",
    });

    (client as any).oauthManager = mockOAuthManager;
    (client as any).initialized = true;
    (client as any).transport.connected = true;
    (client as any).availableTools.set("test_tool", {
      name: "test_tool",
      description: "Test tool",
      inputSchema: { type: "object" },
    });
    (client as any).enabledToolNames.add("test_tool");

    await (client as any).callServerTool("test_tool", {});

    expect(apiHandlerCalled).toBe(true);
  });
});

