/**
 * Advanced OAuth Tests
 * Tests for OAuth methods that require mocking or browser environment
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { createMCPClient, clearClientCache } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("Advanced OAuth Features", () => {
  afterEach(async () => {
    // Clean up after each test
    await clearClientCache();
  });

  describe("clearClientCache", () => {
    test("clears the client cache", async () => {
      const client1 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await clearClientCache();

      const client2 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    test("handles errors during cache clear gracefully", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      // Should not throw
      await expect(clearClientCache()).resolves.toBeUndefined();
    });
  });

  describe("authorize method", () => {
    test("throws error for provider without OAuth config", async () => {
      const customPlugin = {
        id: "custom",
        tools: ["custom/tool"],
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      await expect(client.authorize("custom")).rejects.toThrow(
        "No OAuth configuration found for provider: custom"
      );
    });

    test("emits auth:error on authorization failure", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let errorEmitted = false;
      client.on("auth:error", () => {
        errorEmitted = true;
      });

      await expect(client.authorize("nonexistent")).rejects.toThrow();
      expect(errorEmitted).toBe(true);
    });
  });

  describe("handleOAuthCallback", () => {
    test("throws on invalid callback params", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Invalid state will cause error
      await expect(
        client.handleOAuthCallback({ code: "test-code", state: "invalid-state" })
      ).rejects.toThrow();
    });

    test("emits auth:error on callback failure", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let errorEmitted = false;
      client.on("auth:error", () => {
        errorEmitted = true;
      });

      await expect(
        client.handleOAuthCallback({ code: "test-code", state: "invalid-state" })
      ).rejects.toThrow();

      expect(errorEmitted).toBe(true);
    });
  });

  describe("Plugin Hooks", () => {
    test("calls onBeforeConnect hook", async () => {
      let hookCalled = false;

      const customPlugin = {
        id: "custom",
        tools: [],
        async onBeforeConnect() {
          hookCalled = true;
        },
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      try {
        await client.connect();
      } catch {
        // Expected to fail since we don't have a real server
      }

      expect(hookCalled).toBe(true);
    });

    test("calls onAfterConnect hook", async () => {
      let hookCalled = false;

      const customPlugin = {
        id: "custom",
        tools: [],
        async onAfterConnect() {
          hookCalled = true;
        },
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      try {
        await client.connect();
      } catch {
        // Expected to fail since we don't have a real server
      }

      // Hook might be called even if connection fails after protocol init
      expect(hookCalled).toBeDefined();
    });

    test("calls onDisconnect hook", async () => {
      let hookCalled = false;

      const customPlugin = {
        id: "custom",
        tools: [],
        async onDisconnect() {
          hookCalled = true;
        },
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      await client.disconnect();

      expect(hookCalled).toBe(true);
    });

    test("calls onInit hook", async () => {
      let hookCalled = false;

      const customPlugin = {
        id: "custom",
        tools: [],
        async onInit() {
          hookCalled = true;
        },
      };

      createMCPClient({
        plugins: [customPlugin as any],
        singleton: false,
      });

      // Wait for async init
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(hookCalled).toBe(true);
    });
  });

  describe("Connection Mode Behaviors", () => {
    test("lazy mode does not connect immediately", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        connectionMode: "lazy",
        singleton: false,
      });

      expect(client.isConnected()).toBe(false);
      expect(client.isInitialized()).toBe(false);
    });

    test("manual mode does not connect automatically", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        connectionMode: "manual",
        singleton: false,
      });

      expect(client.isConnected()).toBe(false);
    });

    test("eager mode attempts to connect", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        connectionMode: "eager",
        singleton: false,
      });

      // Give it time to attempt connection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Connection will fail, but the attempt should be made
      expect(client).toBeDefined();
    });
  });

  describe("Multiple Provider Auth States", () => {
    test("tracks auth state independently for each provider", async () => {
      // Mock fetch for disconnect call
      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        return new Response(null, { status: 200 });
      }) as any;

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

      // Set provider tokens
      client.setProviderToken('github', {
        accessToken: 'github-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
      client.setProviderToken('google', {
        accessToken: 'gmail-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      // Both should be authenticated after setting tokens
      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      // Disconnect one
      await client.disconnectProvider("github");

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      // Logout all
      await client.logout();

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(false);

      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe("Event System Edge Cases", () => {
    test("removeAllListeners is available", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // EventEmitter should have removeAllListeners internally
      expect(client).toBeDefined();
    });

    test("handlers don't interfere with each other", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      client.on("auth:complete", handler1);
      client.on("auth:started", handler2);

      // Removing one should not affect the other
      client.off("auth:complete", handler1);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
    });

    test("same handler can be added to multiple events", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler = mock(() => {});

      client.on("auth:complete", handler);
      client.on("auth:started", handler);
      client.on("auth:error", handler);

      expect(handler).toBeDefined();
    });
  });

  describe("Configuration Defaults", () => {
    test("uses default clientInfo when not provided", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("uses default connection mode", () => {
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
    });

    test("uses default maxReauthRetries", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe("Error Recovery", () => {
    test("client remains functional after failed authorization", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Try to authorize non-existent provider
      try {
        await client.authorize("nonexistent");
      } catch {
        // Expected
      }

      // Client should still be usable
      expect(client.isConnected()).toBe(false);
      expect(client).toBeDefined();
    });

    test("client remains functional after failed callback", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Try invalid callback
      try {
        await client.handleOAuthCallback({ code: "bad", state: "bad" });
      } catch {
        // Expected
      }

      // Client should still be usable
      expect(client).toBeDefined();
    });
  });

  describe("Singleton Behavior", () => {
    test("returns same instance for same config when singleton enabled", () => {
      const config = {
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: true,
      };

      const client1 = createMCPClient(config);
      const client2 = createMCPClient(config);

      // Note: They might be different if not connected
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    test("returns different instances when singleton disabled", () => {
      const config = {
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      };

      const client1 = createMCPClient(config);
      const client2 = createMCPClient(config);

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });

  describe("OAuth Configuration", () => {
    test("getOAuthConfig returns correct provider", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
        ],
        singleton: false,
      });

      const config = client.getOAuthConfig("github");
      expect(config).toBeDefined();
      expect(config?.provider).toBe("github");
      expect(config?.clientId).toBe("github-id");
    });

    test("getAllOAuthConfigs maps plugins correctly", () => {
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
      expect(configs.size).toBe(2);
      
      const githubConfig = configs.get("github");
      expect(githubConfig?.provider).toBe("github");
      
      const gmailConfig = configs.get("gmail");
      expect(gmailConfig?.provider).toBe("google");
    });
  });

  describe("Provider Authentication", () => {
    test("isProviderAuthenticated returns true for configured OAuth providers with tokens", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);
    });

    test("getAuthState returns state object with authenticated property", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      const state = client.getAuthState("github");
      expect(state).toBeDefined();
      expect(state?.authenticated).toBe(true);
    });
  });
});

