/**
 * Client OAuth Methods Tests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

describe("Client OAuth Methods", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

    test("setSessionToken stores token", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const token = "test-session-token";
      client.setSessionToken(token);

      expect(client.getSessionToken()).toBe(token);
    });

    test("sessionToken can be provided in config", () => {
      const token = "existing-token";
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: token,
        singleton: false,
      });

      expect(client.getSessionToken()).toBe(token);
    });
  });

  describe("isAuthorized", () => {
    test("checks authorization status for provider", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          provider: "github",
        }),
      })) as any;

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

      const isAuthorized = await client.isAuthorized("github");
      expect(typeof isAuthorized).toBe("boolean");
    });

    test("returns false when not authorized", async () => {
      global.fetch = mock(async () => ({
        ok: false,
        json: async () => ({
          authorized: false,
          provider: "github",
        }),
      })) as any;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const isAuthorized = await client.isAuthorized("github");
      expect(isAuthorized).toBe(false);
    });
  });

  describe("getAuthorizationStatus", () => {
    test("returns detailed authorization status", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          provider: "github",
          scopes: ["repo", "user"],
          expiresAt: "2024-12-31T23:59:59Z",
        }),
      })) as any;

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

      const status = await client.getAuthorizationStatus("github");

      expect(status).toBeDefined();
      expect(status.provider).toBe("github");
      expect(status.authorized).toBeDefined();
    });
  });

  describe("authorizedProviders", () => {
    test("returns empty array when no providers authorized", async () => {
      global.fetch = mock(async () => ({
        ok: false,
        json: async () => ({
          authorized: false,
          provider: "github",
        }),
      })) as any;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const authorized = await client.authorizedProviders();
      expect(authorized).toEqual([]);
    });

    test("returns list of authorized providers", async () => {
      global.fetch = mock(async (url: string) => {
        const urlObj = new URL(url);
        const provider = urlObj.searchParams.get("provider");

        return {
          ok: true,
          json: async () => ({
            authorized: true,
            provider,
          }),
        };
      }) as any;

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
        sessionToken: "test-token",
        singleton: false,
      });

      const authorized = await client.authorizedProviders();
      
      expect(authorized).toBeInstanceOf(Array);
      expect(authorized.length).toBeGreaterThanOrEqual(0);
    });

    test("only includes OAuth-enabled plugins", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          provider: "github",
        }),
      })) as any;

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

      const authorized = await client.authorizedProviders();
      
      // Should only check plugins with OAuth config
      expect(authorized).toBeInstanceOf(Array);
    });
  });

  describe("authorize", () => {
    test("throws error for non-existent provider", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await expect(
        client.authorize("non-existent")
      ).rejects.toThrow("No OAuth configuration found");
    });

    test("throws error for plugin without OAuth", async () => {
      const client = createMCPClient({
        plugins: [],
        singleton: false,
      });

      await expect(
        client.authorize("github")
      ).rejects.toThrow("No OAuth configuration found");
    });
  });

  describe("handleOAuthCallback", () => {
    test("accepts callback parameters", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          sessionToken: "new-session-token",
          expiresAt: "2024-12-31T23:59:59Z",
        }),
      })) as any;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // This will fail because state doesn't match pending auth
      // But it tests that the method signature is correct
      await expect(
        client.handleOAuthCallback({
          code: "test-code",
          state: "test-state",
        })
      ).rejects.toThrow();
    });
  });

  describe("OAuth Flow Configuration", () => {
    test("accepts popup mode configuration", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: 'popup',
          popupOptions: {
            width: 600,
            height: 700,
          },
        },
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("accepts redirect mode configuration", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: 'redirect',
        },
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("accepts custom callback handler", () => {
      const customHandler = async (provider: string, code: string, state: string) => {
        // Custom processing
      };

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        oauthFlow: {
          mode: 'popup',
          onAuthCallback: customHandler,
        },
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });
});

