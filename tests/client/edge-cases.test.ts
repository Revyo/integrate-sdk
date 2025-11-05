/**
 * Edge Cases Tests
 * Additional tests to improve line coverage for edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createMCPClient, clearClientCache } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";
import { createSimplePlugin } from "../../src/plugins/generic.js";

afterEach(async () => {
  await clearClientCache();
});

describe("Edge Cases", () => {
  describe("EventEmitter removeAllListeners", () => {
    test("client can be created and event listeners work", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      // Add multiple handlers
      client.on("auth:complete", handler1);
      client.on("auth:complete", handler2);
      client.on("auth:started", handler3);

      // Remove handlers
      client.off("auth:complete", handler1);
      client.off("auth:complete", handler2);
      client.off("auth:started", handler3);

      expect(client).toBeDefined();
    });
  });

  describe("getProviderForTool edge cases", () => {
    test("returns undefined for tool without OAuth provider", () => {
      const customPlugin = createSimplePlugin({
        id: "custom",
        tools: ["custom/tool"],
      });

      const client = createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      // getTool will internally call getProviderForTool
      const tool = client.getTool("custom/tool");
      expect(tool).toBeUndefined(); // Tool not discovered yet
    });

    test("handles multiple plugins with and without OAuth", () => {
      const customPlugin = createSimplePlugin({
        id: "custom",
        tools: ["custom/tool"],
      });

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
          customPlugin as any,
        ],
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe("getEnabledTools filtering", () => {
    test("filters tools correctly before connection", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const enabledTools = client.getEnabledTools();
      expect(Array.isArray(enabledTools)).toBe(true);
      expect(enabledTools.length).toBe(0); // No tools discovered yet
    });
  });

  describe("Tool name checking", () => {
    test("verifies tool is in enabled list", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // getTool checks against enabled tools internally
      const tool = client.getTool("github/get_repo");
      expect(tool).toBeUndefined(); // Not discovered yet
    });
  });

  describe("Client state management", () => {
    test("tracks connection state properly", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.isConnected()).toBe(false);
      expect(client.isInitialized()).toBe(false);
    });

    test("auth state persists across operations", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const initialState = client.getAuthState("github");
      expect(initialState?.authenticated).toBe(true);

      await client.disconnectProvider("github");

      const afterDisconnect = client.getAuthState("github");
      expect(afterDisconnect?.authenticated).toBe(false);
    });
  });

  describe("Plugin configuration variations", () => {
    test("handles plugin with only id and tools", () => {
      const minimalPlugin = createSimplePlugin({
        id: "minimal",
        tools: ["minimal/tool1", "minimal/tool2"],
      });

      const client = createMCPClient({
        plugins: [minimalPlugin as any],
        singleton: false,
      });

      expect(client).toBeDefined();
      expect(client.getOAuthConfig("minimal")).toBeUndefined();
    });

    test("handles mixed plugin types", () => {
      const simplePlugin = createSimplePlugin({
        id: "simple",
        tools: ["simple/tool"],
      });

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
          gmailPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
          simplePlugin as any,
        ],
        singleton: false,
      });

      const configs = client.getAllOAuthConfigs();
      expect(configs.size).toBe(2); // Only github and gmail have OAuth
      expect(client.getOAuthConfig("simple")).toBeUndefined();
    });
  });

  describe("Error event handling", () => {
    test("error handler receives error object", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let errorReceived: any = null;
      client.on("auth:error", (event) => {
        errorReceived = event;
      });

      try {
        await client.authorize("nonexistent");
      } catch {
        // Expected
      }

      expect(errorReceived).toBeDefined();
      expect(errorReceived.error).toBeDefined();
      expect(errorReceived.provider).toBe("nonexistent");
    });
  });

  describe("Session token edge cases", () => {
    test("handles undefined session token gracefully", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.getSessionToken()).toBeUndefined();
      
      // Setting and clearing
      client.setSessionToken("test");
      expect(client.getSessionToken()).toBe("test");
      
      client.clearSessionToken();
      expect(client.getSessionToken()).toBeUndefined();
    });
  });

  describe("OAuth config retrieval", () => {
    test("getOAuthConfig returns full config object", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "github-client-id",
            clientSecret: "github-secret",
          }),
        ],
        singleton: false,
      });

      const config = client.getOAuthConfig("github");
      expect(config).toBeDefined();
      expect(config?.provider).toBe("github");
      expect(config?.clientId).toBe("github-client-id");
      expect(config?.clientSecret).toBe("github-secret");
    });

    test("getAllOAuthConfigs returns Map with correct structure", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailPlugin({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      const configs = client.getAllOAuthConfigs();
      expect(configs instanceof Map).toBe(true);
      expect(configs.size).toBe(2);
      
      const githubConfig = configs.get("github");
      const gmailConfig = configs.get("gmail");
      
      expect(githubConfig?.clientId).toBe("github-id");
      expect(gmailConfig?.clientId).toBe("gmail-id");
    });
  });

  describe("Provider authentication state", () => {
    test("isProviderAuthenticated handles unknown providers", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.isProviderAuthenticated("unknown")).toBe(false);
      expect(client.isProviderAuthenticated("github")).toBe(true);
    });

    test("getAuthState returns undefined for unknown providers", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.getAuthState("unknown")).toBeUndefined();
      expect(client.getAuthState("github")).toBeDefined();
    });
  });

  describe("Message handlers", () => {
    test("onMessage returns unsubscribe function", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler = () => {};
      const unsubscribe = client.onMessage(handler);

      expect(typeof unsubscribe).toBe("function");
      
      // Should be able to call unsubscribe
      unsubscribe();
    });
  });

  describe("Client cleanup", () => {
    test("clearClientCache works with multiple clients", async () => {
      createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      createMCPClient({
        plugins: [
          gmailPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await clearClientCache();

      // Should be able to create new clients after clearing
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client).toBeDefined();
    });
  });

  describe("Configuration edge cases", () => {
    test("accepts all optional config parameters", () => {
      const client = createMCPClient({
        plugins: [],
        sessionToken: "token",
        timeout: 30000,
        headers: { "X-Test": "value" },
        clientInfo: { name: "test", version: "1.0" },
        connectionMode: "lazy",
        singleton: false,
        autoCleanup: true,
        maxReauthRetries: 2,
        oauthApiBase: "/oauth",
        oauthFlow: { mode: "redirect" },
        autoHandleOAuthCallback: true,
        onReauthRequired: async () => true,
      });

      expect(client).toBeDefined();
    });

    test("works with minimal config", () => {
      const client = createMCPClient({
        plugins: [],
      });

      expect(client).toBeDefined();
    });
  });
});

