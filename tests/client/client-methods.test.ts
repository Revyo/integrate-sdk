/**
 * Client Methods Tests
 * Tests for additional client methods to improve coverage
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("Client Methods", () => {
  beforeEach(() => {
    // Clear localStorage before each test to prevent token pollution
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  describe("getAvailableTools", () => {
    test("returns empty array before connection", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,  // Ensure fresh instance for testing
      });

      const tools = client.getAvailableTools();
      expect(tools).toEqual([]);
    });
  });

  describe("disconnect", () => {
    test("sets initialized to false", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      // Client is not connected, but disconnect should still work
      await client.disconnect();
      expect(client.isInitialized()).toBe(false);
    });

    test("calls onDisconnect hooks for all plugins", async () => {
      let disconnectCalled = false;

      const customPlugin = {
        id: "custom",
        tools: ["custom/tool"],
        async onDisconnect() {
          disconnectCalled = true;
        },
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
      });

      await client.disconnect();
      expect(disconnectCalled).toBe(true);
    });
  });

  describe("reauthenticate", () => {
    test("throws error if provider not found", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await expect(client.reauthenticate("nonexistent")).rejects.toThrow(
        'Provider "nonexistent" not found'
      );
    });

    test("throws error if no handler configured", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await expect(client.reauthenticate("github")).rejects.toThrow(
        "No re-authentication handler configured"
      );
    });

    test("calls handler and updates state on success", async () => {
      let handlerCalled = false;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        onReauthRequired: async () => {
          handlerCalled = true;
          return true;
        },
      });

      const result = await client.reauthenticate("github");
      expect(result).toBe(true);
      expect(handlerCalled).toBe(true);
      expect(client.isProviderAuthenticated("github")).toBe(true);
    });

    test("preserves state on failure", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        onReauthRequired: async () => false,
        singleton: false,
      });

      // Set initial authenticated state with a token
      client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
      expect(client.isProviderAuthenticated("github")).toBe(true);

      const result = await client.reauthenticate("github");
      expect(result).toBe(false);
      expect(client.isProviderAuthenticated("github")).toBe(true); // Still true after failed reauth
    });
  });

  describe("Plugin lifecycle hooks", () => {
    test("calls onBeforeConnect hooks", async () => {
      let beforeConnectCalled = false;

      const customPlugin = {
        id: "custom",
        tools: [],
        async onBeforeConnect() {
          beforeConnectCalled = true;
        },
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
      });

      // This will fail to connect, but that's okay - we just want to verify the hook is called
      try {
        await client.connect();
      } catch {
        // Expected to fail
      }

      expect(beforeConnectCalled).toBe(true);
    });
  });

  describe("Authentication state", () => {
    test("getAuthState returns undefined for unknown provider", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client.getAuthState("nonexistent")).toBeUndefined();
    });

    test("isProviderAuthenticated returns false for unknown provider", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client.isProviderAuthenticated("nonexistent")).toBe(false);
    });

    test("tracks auth state for multiple providers", () => {
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
        ],
        singleton: false,
      });

      // Initially not authenticated (no tokens)
      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("gmail")).toBe(false);

      // Set tokens for providers
      client.setProviderToken('github', {
        accessToken: 'test-github-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
      client.setProviderToken('gmail', {
        accessToken: 'test-google-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      // Now authenticated
      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("gmail")).toBe(true);
    });
  });

  describe("Client configuration", () => {
    test("accepts custom client info", () => {
      const client = createMCPClient({
        plugins: [],
        clientInfo: {
          name: "custom-client",
          version: "2.0.0",
        },
      });

      expect(client).toBeDefined();
    });

    test("accepts custom timeout and headers", () => {
      const client = createMCPClient({
        plugins: [],
        timeout: 60000,
        headers: {
          "X-Custom": "value",
        },
      });

      expect(client).toBeDefined();
    });

    test("accepts maxReauthRetries", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        maxReauthRetries: 3,
      });

      expect(client).toBeDefined();
    });
  });

  describe("Tool management", () => {
    test("getTool returns undefined for non-existent tool", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client.getTool("nonexistent")).toBeUndefined();
    });

    test("getEnabledTools returns empty array before connection", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client.getEnabledTools()).toEqual([]);
    });
  });

  describe("OAuth configuration", () => {
    test("getAllOAuthConfigs returns empty map when no plugins have OAuth", () => {
      const customPlugin = {
        id: "custom",
        tools: ["custom/tool"],
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
      });

      const configs = client.getAllOAuthConfigs();
      expect(configs.size).toBe(0);
    });

    test("getOAuthConfig returns undefined for plugin without OAuth", () => {
      const customPlugin = {
        id: "custom",
        tools: ["custom/tool"],
      };

      const client = createMCPClient({
        plugins: [customPlugin as any],
      });

      expect(client.getOAuthConfig("custom")).toBeUndefined();
    });
  });
});

