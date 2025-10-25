/**
 * Simplified Integration Tests
 * Tests that don't require a full HTTP streaming server
 */

import { describe, test, expect } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { createSimplePlugin, genericOAuthPlugin } from "../../src/plugins/generic.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("Integration - Client Configuration", () => {
  test("creates client with multiple plugins", () => {
    const client = createMCPClient({
      serverUrl: "http://localhost:3000/api/v1/mcp",
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
      serverUrl: "http://localhost:3000/api/v1/mcp",
      plugins: [plugin1, plugin2],
    });

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(initOrder).toEqual(["plugin1-init", "plugin2-init"]);
  });

  test("correctly filters tools by enabled plugins", () => {
    const client = createMCPClient({
      serverUrl: "http://localhost:3000/api/v1/mcp",
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
      serverUrl: "http://localhost:3000/api/v1/mcp",
      plugins: [slackPlugin],
    });

    const config = client.getOAuthConfig("slack");
    expect(config).toBeDefined();
    expect(config?.provider).toBe("slack");
    expect(config?.scopes).toContain("chat:write");
  });
});

describe("Integration - Error Handling", () => {
  test("throws error when calling tool before initialization", async () => {
    const client = createMCPClient({
      serverUrl: "http://localhost:3000/api/v1/mcp",
      plugins: [
        createSimplePlugin({
          id: "test",
          tools: ["test/tool"],
        }),
      ],
    });

    await expect(client.callTool("test/tool")).rejects.toThrow(
      "Client not initialized"
    );
  });

  test("handles connection to invalid URL", async () => {
    const client = createMCPClient({
      serverUrl: "http://invalid-server-that-does-not-exist:99999/mcp",
      plugins: [],
      timeout: 1000,
    });

    await expect(client.connect()).rejects.toThrow();
  }, 5000);
});

describe("Integration - Plugin Combinations", () => {
  test("works with mix of OAuth and simple plugins", () => {
    const client = createMCPClient({
      serverUrl: "http://localhost:3000/api/v1/mcp",
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
      serverUrl: "http://localhost:3000/api/v1/mcp",
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

