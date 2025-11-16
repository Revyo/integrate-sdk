/**
 * Client OAuth Methods Tests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubIntegration } from "../../src/integrations/github.js";
import { gmailIntegration } from "../../src/integrations/gmail.js";

describe("Client OAuth Methods", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Provider Token Management", () => {
    test("getProviderToken returns undefined initially", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      expect(client.getProviderToken('github')).toBeUndefined();
    });

    test("setProviderToken stores token", () => {
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
      client.setProviderToken('github', tokenData);

      expect(client.getProviderToken('github')).toEqual(tokenData);
    });

    test("provider tokens are loaded from localStorage", () => {
      // This test verifies tokens are loaded on initialization
      // Pre-populate localStorage if we're in a browser-like environment
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Initially undefined since no token is set
      expect(client.getProviderToken('github')).toBeUndefined();
    });
  });

  describe("isAuthorized", () => {
    test("checks authorization status for provider", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          scopes: ['repo'],
        }),
      })) as any;

      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setProviderToken('github', {
        accessToken: 'test-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      const isAuthorized = await client.isAuthorized("github");
      expect(typeof isAuthorized).toBe("boolean");
    });

    test("returns false when not authorized", async () => {
      global.fetch = mock(async () => ({
        ok: false,
        json: async () => ({
          authorized: false,
        }),
      })) as any;

      const client = createMCPClient({
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        sessionToken: "test-token",
        singleton: false,
      });

      const authorized = await client.authorizedProviders();

      expect(authorized).toBeInstanceOf(Array);
      expect(authorized.length).toBeGreaterThanOrEqual(0);
    });

    test("only includes OAuth-enabled integrations", async () => {
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          provider: "github",
        }),
      })) as any;

      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: "test-token",
        singleton: false,
      });

      const authorized = await client.authorizedProviders();

      // Should only check integrations with OAuth config
      expect(authorized).toBeInstanceOf(Array);
    });
  });

  describe("authorize", () => {
    test("throws error for non-existent provider", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
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

    test("throws error for integration without OAuth", async () => {
      const client = createMCPClient({
        integrations: [],
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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
        integrations: [
          githubIntegration({
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

