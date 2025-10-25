/**
 * MCP Client Tests
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { MCPClient, createMCPClient } from "../../src/client.js";
import { createSimplePlugin } from "../../src/plugins/generic.js";
import { githubPlugin } from "../../src/plugins/github.js";

describe("MCP Client", () => {
  describe("createMCPClient", () => {
    test("creates client with plugins", () => {
      const plugin = createSimplePlugin({
        id: "test",
        tools: ["test/tool1", "test/tool2"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [plugin],
      });

      expect(client).toBeInstanceOf(MCPClient);
      expect(client.isConnected()).toBe(false);
      expect(client.isInitialized()).toBe(false);
    });

    test("accepts custom timeout and headers", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
        timeout: 60000,
        headers: {
          "X-Custom-Header": "value",
        },
      });

      expect(client).toBeInstanceOf(MCPClient);
    });

    test("accepts custom client info", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
        clientInfo: {
          name: "custom-client",
          version: "2.0.0",
        },
      });

      expect(client).toBeInstanceOf(MCPClient);
    });
  });

  describe("Plugin Initialization", () => {
    test("calls onInit for all plugins", async () => {
      let initCount = 0;

      const plugin1 = createSimplePlugin({
        id: "test1",
        tools: ["test1/tool"],
        onInit: () => {
          initCount++;
        },
      });

      const plugin2 = createSimplePlugin({
        id: "test2",
        tools: ["test2/tool"],
        onInit: () => {
          initCount++;
        },
      });

      createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [plugin1, plugin2],
      });

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(initCount).toBe(2);
    });
  });

  describe("OAuth Configuration", () => {
    test("getOAuthConfig returns config for plugin", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [plugin],
      });

      const config = client.getOAuthConfig("github");
      expect(config).toBeDefined();
      expect(config?.provider).toBe("github");
      expect(config?.clientId).toBe("test-id");
    });

    test("getOAuthConfig returns undefined for non-existent plugin", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      const config = client.getOAuthConfig("nonexistent");
      expect(config).toBeUndefined();
    });

    test("getAllOAuthConfigs returns all configs", () => {
      const githubPlug = githubPlugin({
        clientId: "github-id",
        clientSecret: "github-secret",
      });

      const simplePlugin = createSimplePlugin({
        id: "simple",
        tools: ["simple/tool"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [githubPlug, simplePlugin],
      });

      const configs = client.getAllOAuthConfigs();
      expect(configs.size).toBe(1); // Only github has OAuth
      expect(configs.has("github")).toBe(true);
      expect(configs.has("simple")).toBe(false);
    });
  });

  describe("Tool Management", () => {
    test("getEnabledTools returns empty before connection", () => {
      const plugin = createSimplePlugin({
        id: "test",
        tools: ["test/tool1", "test/tool2"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [plugin],
      });

      const tools = client.getEnabledTools();
      expect(tools).toEqual([]);
    });

    test("getTool returns undefined before connection", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      const tool = client.getTool("test/tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("Connection State", () => {
    test("isConnected returns false initially", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      expect(client.isConnected()).toBe(false);
    });

    test("isInitialized returns false initially", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("callTool throws when not initialized", async () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      await expect(client.callTool("test/tool")).rejects.toThrow(
        "Client not initialized"
      );
    });
  });

  describe("Message Handlers", () => {
    test("onMessage registers handler and returns unsubscribe function", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        plugins: [],
      });

      const handler = mock(() => {});
      const unsubscribe = client.onMessage(handler);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });
});

