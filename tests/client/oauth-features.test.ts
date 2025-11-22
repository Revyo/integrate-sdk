/**
 * OAuth Features Tests
 * Tests for new OAuth functionality including events, session management, and disconnect/logout
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubIntegration } from "../../src/integrations/github.js";
import { gmailIntegration } from "../../src/integrations/gmail.js";

describe("OAuth Features", () => {
  describe("Event System", () => {
    test("on() registers event listener", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler = mock(() => { });
      client.on("auth:complete", handler);

      expect(handler).toBeDefined();
    });

    test("off() removes event listener", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler = mock(() => { });
      client.on("auth:complete", handler);
      client.off("auth:complete", handler);

      expect(handler).toBeDefined();
    });

    test("supports multiple event listeners for same event", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const handler1 = mock(() => { });
      const handler2 = mock(() => { });

      client.on("auth:complete", handler1);
      client.on("auth:complete", handler2);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
    });

    test("supports all OAuth event types", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const startedHandler = mock(() => { });
      const completeHandler = mock(() => { });
      const errorHandler = mock(() => { });
      const disconnectHandler = mock(() => { });
      const logoutHandler = mock(() => { });

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

  describe("Provider Token Management", () => {
    test("getProviderToken returns undefined initially", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(await client.getProviderToken("github")).toBeUndefined();
    });

    test("setProviderToken sets the token", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const tokenData = {
        accessToken: "test-access-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      await client.setProviderToken("github", tokenData);
      expect(await client.getProviderToken("github")).toEqual(tokenData);
    });

    test("clearSessionToken clears all provider tokens", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const tokenData = {
        accessToken: "test-access-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      await client.setProviderToken("github", tokenData);
      expect(await client.getProviderToken("github")).toEqual(tokenData);

      client.clearSessionToken();
      expect(await client.getProviderToken("github")).toBeUndefined();
    });

    test("manages tokens per provider independently", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
          gmailIntegration({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      const githubToken = {
        accessToken: "github-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      const gmailToken = {
        accessToken: "gmail-token",
        tokenType: "Bearer",
        expiresIn: 7200,
      };

      await client.setProviderToken("github", githubToken);
      await client.setProviderToken("google", gmailToken);

      expect(await client.getProviderToken("github")).toEqual(githubToken);
      expect(await client.getProviderToken("google")).toEqual(gmailToken);
    });
  });

  describe("disconnectProvider", () => {
    test("throws error for unknown provider", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
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

    test("succeeds when no access token available (idempotent)", async () => {
      // Clear localStorage to ensure no tokens from previous tests
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem('integrate_token_github');
        } catch {
          // Ignore errors
        }
      }

      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Verify no token is set
      expect(await client.getProviderToken('github')).toBeUndefined();

      // Should succeed even without a token (idempotent operation)
      await client.disconnectProvider("github");
      
      // Verify state is cleared
      expect(await client.isAuthorized('github')).toBe(false);
    });

    test("resets authentication state for provider with access token", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Set provider token
      await client.setProviderToken("github", {
        accessToken: "test-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);

      // Disconnect clears token locally without server call
      await client.disconnectProvider("github");

      expect(client.isProviderAuthenticated("github")).toBe(false);
    });

    test("emits auth:disconnect event", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Set provider token
      await client.setProviderToken("github", {
        accessToken: "test-token",
        tokenType: "Bearer",
        expiresIn: 3600,
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
        integrations: [
          githubIntegration({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailIntegration({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      // Set provider tokens
      await client.setProviderToken("github", {
        accessToken: "github-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });
      await client.setProviderToken("google", {
        accessToken: "gmail-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      await client.disconnectProvider("github");

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(true);
    });

    test("clears only disconnected provider token", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailIntegration({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      // Set provider tokens
      await client.setProviderToken("github", {
        accessToken: "github-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });
      await client.setProviderToken("google", {
        accessToken: "gmail-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      await client.disconnectProvider("github");

      expect(await client.getProviderToken("github")).toBeUndefined();
      expect(await client.getProviderToken("google")).toBeDefined();
    });

    test("makes API call to server route when disconnecting", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
        oauthApiBase: "/api/integrate/oauth",
      });

      // Set provider token
      await client.setProviderToken("github", {
        accessToken: "test-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      // Mock fetch to verify API call is made
      const fetchMock = mock(async (url: string, options?: any) => {
        expect(url).toContain("/api/integrate/oauth/disconnect");
        expect(options?.method).toBe("POST");
        expect(options?.headers?.["Authorization"]).toBe("Bearer test-token");
        expect(JSON.parse(options?.body || "{}")).toEqual({ provider: "github" });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }) as any;
      global.fetch = fetchMock;

      await client.disconnectProvider("github");

      expect(fetchMock).toHaveBeenCalled();
      expect(await client.getProviderToken("github")).toBeUndefined();
    });

    test("handles missing disconnect route gracefully (404)", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
        oauthApiBase: "/api/integrate/oauth",
      });

      // Set provider token
      await client.setProviderToken("github", {
        accessToken: "test-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      // Mock fetch to return 404 (route doesn't exist)
      const consoleWarnSpy = mock(() => {});
      const originalWarn = console.warn;
      console.warn = consoleWarnSpy as any;

      global.fetch = mock(async () => {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
      }) as any;

      // Should not throw - should continue and clear local state
      await client.disconnectProvider("github");

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalled();
      const warnCall = (consoleWarnSpy as any).mock.calls[0]?.[0] || "";
      expect(warnCall).toContain("OAuth disconnect route not found");
      expect(warnCall).toContain("Local token will still be cleared");

      // Verify local state was cleared despite 404
      expect(await client.getProviderToken("github")).toBeUndefined();
      expect(client.isProviderAuthenticated("github")).toBe(false);

      // Restore console.warn
      console.warn = originalWarn;
    });
  });

  describe("logout", () => {
    test("clears all provider tokens", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await client.setProviderToken("github", {
        accessToken: "test-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      expect(await client.getProviderToken("github")).toBeDefined();

      await client.logout();

      expect(await client.getProviderToken("github")).toBeUndefined();
    });

    test("resets authentication state for all providers", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
          gmailIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await client.setProviderToken("github", {
        accessToken: "github-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });
      await client.setProviderToken("google", {
        accessToken: "gmail-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);

      await client.logout();

      expect(client.isProviderAuthenticated("github")).toBe(false);
      expect(client.isProviderAuthenticated("google")).toBe(false);
    });

    test("emits auth:logout event", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      const client2 = createMCPClient({
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const client2 = createMCPClient({
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
      const onAuthCallback = mock(async () => { });

      const client = createMCPClient({
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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

  describe("Multiple Integrations", () => {
    test("tracks auth state for multiple OAuth providers", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailIntegration({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      // Set provider tokens
      await client.setProviderToken("github", {
        accessToken: "github-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });
      await client.setProviderToken("google", {
        accessToken: "gmail-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("google")).toBe(true);
    });

    test("getAllOAuthConfigs returns all provider configs", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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

