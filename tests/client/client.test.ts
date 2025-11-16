/**
 * MCP Client Tests
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { MCPClient, createMCPClient } from "../../src/client.js";
import { createSimpleIntegration } from "../../src/integrations/generic.js";
import { githubIntegration } from "../../src/integrations/github.js";

describe("MCP Client", () => {
  describe("createMCPClient", () => {
    test("creates client with integrations", () => {
      const integration = createSimpleIntegration({
        id: "test",
        tools: ["test/tool1", "test/tool2"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [integration],
      });

      expect(client).toBeInstanceOf(MCPClient);
      expect(client.isConnected()).toBe(false);
      expect(client.isInitialized()).toBe(false);
    });

    test("accepts custom timeout and headers", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
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
        integrations: [],
        clientInfo: {
          name: "custom-client",
          version: "2.0.0",
        },
      });

      expect(client).toBeInstanceOf(MCPClient);
    });
  });

  describe("Integration Initialization", () => {
    test("calls onInit for all integrations", async () => {
      let initCount = 0;

      const integration1 = createSimpleIntegration({
        id: "test1",
        tools: ["test1/tool"],
        onInit: () => {
          initCount++;
        },
      });

      const integration2 = createSimpleIntegration({
        id: "test2",
        tools: ["test2/tool"],
        onInit: () => {
          initCount++;
        },
      });

      createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [integration1, integration2],
      });

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(initCount).toBe(2);
    });
  });

  describe("OAuth Configuration", () => {
    test("getOAuthConfig returns config for integration", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [integration],
      });

      const config = client.getOAuthConfig("github");
      expect(config).toBeDefined();
      expect(config?.provider).toBe("github");
      expect(config?.clientId).toBe("test-id");
    });

    test("getOAuthConfig returns undefined for non-existent integration", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
      });

      const config = client.getOAuthConfig("nonexistent");
      expect(config).toBeUndefined();
    });

    test("getAllOAuthConfigs returns all configs", () => {
      const githubPlug = githubIntegration({
        clientId: "github-id",
        clientSecret: "github-secret",
      });

      const simpleIntegration = createSimpleIntegration({
        id: "simple",
        tools: ["simple/tool"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [githubPlug, simpleIntegration],
      });

      const configs = client.getAllOAuthConfigs();
      expect(configs.size).toBe(1); // Only github has OAuth
      expect(configs.has("github")).toBe(true);
      expect(configs.has("simple")).toBe(false);
    });
  });

  describe("Tool Management", () => {
    test("getEnabledTools returns empty before connection", () => {
      const integration = createSimpleIntegration({
        id: "test",
        tools: ["test/tool1", "test/tool2"],
      });

      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [integration],
      });

      const tools = client.getEnabledTools();
      expect(tools).toEqual([]);
    });

    test("getTool returns undefined before connection", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
      });

      const tool = client.getTool("test/tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("Connection State", () => {
    test("isConnected returns false initially", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
      });

      expect(client.isConnected()).toBe(false);
    });

    test("isInitialized returns false initially", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
      });

      expect(client.isInitialized()).toBe(false);
    });
  });

  describe("Error Handling", () => {
    test("integration methods work through API handler without initialization", async () => {
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
        integrations: [
          githubIntegration({
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
  });

  describe("Message Handlers", () => {
    test("onMessage registers handler and returns unsubscribe function", () => {
      const client = createMCPClient({
        serverUrl: "http://localhost:3000/mcp",
        integrations: [],
      });

      const handler = mock(() => { });
      const unsubscribe = client.onMessage(handler);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });
  });
});

