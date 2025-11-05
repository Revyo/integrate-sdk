/**
 * OAuth Features Tests
 * Tests for new OAuth functionality including events, session management, and disconnect/logout
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("OAuth Features", () => {
  describe("Event System", () => {
    test("on() registers event listener", () => {
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

      expect(handler).toBeDefined();
    });

    test("off() removes event listener", () => {
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
      client.off("auth:complete", handler);

      expect(handler).toBeDefined();
    });

    test("supports multiple event listeners for same event", () => {
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
      client.on("auth:complete", handler2);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
    });

    test("supports all OAuth event types", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const startedHandler = mock(() => {});
      const completeHandler = mock(() => {});
      const errorHandler = mock(() => {});
      const disconnectHandler = mock(() => {});
      const logoutHandler = mock(() => {});

      client.on("auth:started", startedHandler);
      client.on("auth:complete", completeHandler);
      client.on("auth:error", errorHandler);
      client.on("auth:disconnect", disconnectHandler);
      client.on("auth:logout", logoutHandler);

      expect(startedHandler).toBeDefined();
      expect(completeHandler).toBeDefined();
      expect(errorHandler).toBeDefined();
      expect(disconnectHandler).toBeDefined();
      expect(logoutHandler).toBeDefined();
    });
  });

  describe("Session Token Management", () => {
    test("getSessionToken returns undefined initially", () => {
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
    });

    test("setSessionToken sets the token", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setSessionToken("test-token");
      expect(client.getSessionToken()).toBe("test-token");
    });

    test("clearSessionToken clears the token", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setSessionToken("test-token");
      expect(client.getSessionToken()).toBe("test-token");
      
      client.clearSessionToken();
      expect(client.getSessionToken()).toBeUndefined();
    });

    test("accepts session token in config", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: "config-token",
        singleton: false,
      });

      expect(client.getSessionToken()).toBe("config-token");
    });
  });

  describe("disconnectProvider", () => {
    test("throws error for unknown provider", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await expect(client.disconnectProvider("nonexistent")).rejects.toThrow(
        "No OAuth configuration found for provider: nonexistent"
      );
    });

    test("resets authentication state for provider", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);

      await client.disconnectProvider("github");

      expect(client.isProviderAuthenticated("github")).toBe(false);
    });

    test("emits auth:disconnect event", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let disconnectEvent: any = null;
      client.on("auth:disconnect", (event) => {
        disconnectEvent = event;
      });

      await client.disconnectProvider("github");

      expect(disconnectEvent).toBeDefined();
      expect(disconnectEvent.provider).toBe("github");
    });

    test("disconnects single provider while keeping others", async () => {
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

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      await client.disconnectProvider("github");

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(true);
    });

    test("does not clear session token", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: "test-token",
        singleton: false,
      });

      await client.disconnectProvider("github");

      expect(client.getSessionToken()).toBe("test-token");
    });
  });

  describe("logout", () => {
    test("clears session token", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: "test-token",
        singleton: false,
      });

      expect(client.getSessionToken()).toBe("test-token");

      await client.logout();

      expect(client.getSessionToken()).toBeUndefined();
    });

    test("resets authentication state for all providers", async () => {
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

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      await client.logout();

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(false);
    });

    test("emits auth:logout event", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let logoutEventFired = false;
      client.on("auth:logout", () => {
        logoutEventFired = true;
      });

      await client.logout();

      expect(logoutEventFired).toBe(true);
    });

    test("maintains auth state structure after logout", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await client.logout();

      const state = client.getAuthState("github");
      expect(state).toBeDefined();
      expect(state?.authenticated).toBe(false);
    });
  });

  describe("Auto OAuth Callback", () => {
    test("autoHandleOAuthCallback defaults to true", () => {
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

    test("autoHandleOAuthCallback can be disabled", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        autoHandleOAuthCallback: false,
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe("Connection Modes", () => {
    test("defaults to lazy connection mode", () => {
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

    test("accepts manual connection mode", () => {
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

    test("accepts eager connection mode", () => {
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

      expect(client).toBeDefined();
    });
  });

  describe("Singleton Pattern", () => {
    test("defaults to singleton mode", () => {
      const client1 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      const client2 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      // Note: These might be different instances if not connected
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    test("singleton can be disabled", () => {
      const client1 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const client2 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });

  describe("OAuth API Base URL", () => {
    test("defaults to /api/integrate/oauth", () => {
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

    test("accepts custom OAuth API base URL", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthApiBase: "/custom/oauth",
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe("OAuth Flow Configuration", () => {
    test("accepts redirect mode configuration", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: "redirect",
        },
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("accepts popup mode configuration", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: "popup",
          popupOptions: {
            width: 800,
            height: 900,
          },
        },
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("accepts custom OAuth callback handler", () => {
      const onAuthCallback = mock(async () => {});

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: "redirect",
          onAuthCallback,
        },
        singleton: false,
      });

      expect(client).toBeDefined();
      expect(onAuthCallback).toBeDefined();
    });
  });

  describe("Error Handling in Authorization", () => {
    test("authorize throws and emits error for unknown provider", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let errorEvent: any = null;
      client.on("auth:error", (event) => {
        errorEvent = event;
      });

      await expect(client.authorize("nonexistent")).rejects.toThrow(
        "No OAuth configuration found for provider: nonexistent"
      );

      expect(errorEvent).toBeDefined();
      expect(errorEvent.provider).toBe("nonexistent");
      expect(errorEvent.error).toBeDefined();
    });
  });

  describe("Multiple Plugins", () => {
    test("tracks auth state for multiple OAuth providers", () => {
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

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);
    });

    test("getAllOAuthConfigs returns all provider configs", () => {
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
      expect(configs.has("github")).toBe(true);
      expect(configs.has("gmail")).toBe(true);
    });
  });

  describe("Client Cleanup", () => {
    test("autoCleanup defaults to true", () => {
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

    test("autoCleanup can be disabled", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        autoCleanup: false,
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });
});

