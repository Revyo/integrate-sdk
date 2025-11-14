/**
 * Simplified Integration Tests
 * Tests that don't require a full HTTP streaming server
 */

import { describe, test, expect, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { createSimplePlugin, genericOAuthPlugin } from "../../src/plugins/generic.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("Integration - Client Configuration", () => {
  test("creates client with multiple plugins", () => {
    const client = createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [
        githubPlugin({
          clientId: "test-id",
          clientSecret: "test-secret",
        }),
        gmailPlugin({
          clientId: "gmail-id",
          clientSecret: "gmail-secret",
        }),
      ],
    });

    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
    
    const oauthConfigs = client.getAllOAuthConfigs();
    expect(oauthConfigs.size).toBe(2);
    expect(oauthConfigs.has("github")).toBe(true);
    expect(oauthConfigs.has("gmail")).toBe(true);
  });

  test("properly initializes plugins with lifecycle hooks", async () => {
    let initOrder: string[] = [];

    const plugin1 = createSimplePlugin({
      id: "plugin1",
      tools: ["plugin1/tool"],
      onInit: () => {
        initOrder.push("plugin1-init");
      },
    });

    const plugin2 = createSimplePlugin({
      id: "plugin2",
      tools: ["plugin2/tool"],
      onInit: () => {
        initOrder.push("plugin2-init");
      },
    });

    createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [plugin1, plugin2],
    });

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(initOrder).toEqual(["plugin1-init", "plugin2-init"]);
  });

  test("correctly filters tools by enabled plugins", () => {
    const client = createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [
        createSimplePlugin({
          id: "test",
          tools: ["test/tool1", "test/tool2", "test/tool3"],
        }),
      ],
    });

    // Before connection, enabled tools is empty
    expect(client.getEnabledTools()).toEqual([]);
  });

  test("supports custom OAuth providers", () => {
    const slackPlugin = genericOAuthPlugin({
      id: "slack",
      provider: "slack",
      clientId: "slack-id",
      clientSecret: "slack-secret",
      scopes: ["chat:write"],
      tools: ["slack/sendMessage"],
    });

    const client = createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [slackPlugin],
    });

    const config = client.getOAuthConfig("slack");
    expect(config).toBeDefined();
    expect(config?.provider).toBe("slack");
    expect(config?.scopes).toContain("chat:write");
  });
});

describe("Integration - Error Handling", () => {
  test("can call tools through API handler without initialization", async () => {
    const mockFetch = mock(async (url: string) => {
      if (url.includes("/api/integrate/mcp")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: "text", text: "api handler result" }],
          }),
          headers: new Headers(),
        } as Response;
      }
      return { ok: false } as Response;
    }) as any;

    global.fetch = mockFetch;

    const client = createMCPClient({
      plugins: [
        githubPlugin({
          clientId: "test-id",
        }),
      ],
      connectionMode: 'manual',  // Manual mode - no auto-connect
      singleton: false,
    });

    // Should work through API handler without calling connect()
    const result = await client.github.getRepo({ owner: "test", repo: "test" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("api handler result");
  });

  test.skip("handles connection to invalid URL", async () => {
    // This test is no longer applicable since the server URL is now
    // determined by NODE_ENV and cannot be configured per-client.
    // Connection error handling is tested through other integration tests.
  }, 5000);
});

describe("Integration - Plugin Combinations", () => {
  test("works with mix of OAuth and simple plugins", () => {
    const client = createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [
        githubPlugin({
          clientId: "github-id",
          clientSecret: "github-secret",
        }),
        createSimplePlugin({
          id: "local",
          tools: ["local/tool1", "local/tool2"],
        }),
      ],
    });

    const configs = client.getAllOAuthConfigs();
    expect(configs.size).toBe(1); // Only GitHub has OAuth
    expect(configs.has("github")).toBe(true);
    expect(configs.has("local")).toBe(false);
  });

  test("handles duplicate tool names across plugins", () => {
    // This tests that the client can handle plugins with overlapping tool names
    const client = createMCPClient({
      serverUrl: "https://mcp.integrate.dev:8080/api/v1/mcp",
      plugins: [
        createSimplePlugin({
          id: "plugin1",
          tools: ["shared/tool", "plugin1/tool"],
        }),
        createSimplePlugin({
          id: "plugin2",
          tools: ["shared/tool", "plugin2/tool"],
        }),
      ],
    });

    expect(client).toBeDefined();
  });
});

