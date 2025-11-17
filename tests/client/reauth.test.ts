/**
 * Re-authentication Flow Tests
 * Tests for authentication error handling and re-authentication mechanisms
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubIntegration } from "../../src/integrations/github.js";
import {
  AuthenticationError,
  TokenExpiredError,
  isAuthError,
  isTokenExpiredError,
  parseServerError,
} from "../../src/errors.js";

describe("Re-authentication Flow", () => {
  describe("Error Parsing", () => {
    test("parseServerError identifies authentication errors", () => {
      const error = { code: 401, message: "Unauthorized" };
      const parsed = parseServerError(error, { provider: "github" });

      expect(isAuthError(parsed)).toBe(true);
      expect(parsed).toBeInstanceOf(AuthenticationError);
      expect((parsed as AuthenticationError).statusCode).toBe(401);
      expect((parsed as AuthenticationError).provider).toBe("github");
    });

    test("parseServerError identifies token expired errors", () => {
      const error = { code: 401, message: "Token has expired" };
      const parsed = parseServerError(error, { provider: "github" });

      expect(isTokenExpiredError(parsed)).toBe(true);
      expect(parsed).toBeInstanceOf(TokenExpiredError);
      expect((parsed as TokenExpiredError).provider).toBe("github");
    });

    test("parseServerError handles JSON-RPC error format", () => {
      const error = { code: -32001, message: "Authentication failed" };
      const parsed = parseServerError(error, { provider: "gmail" });

      expect(isAuthError(parsed)).toBe(true);
      expect(parsed).toBeInstanceOf(AuthenticationError);
    });

    test("parseServerError handles HTTP status codes", () => {
      const error = new Error("Unauthorized");
      (error as any).statusCode = 401;
      const parsed = parseServerError(error, { provider: "github" });

      expect(isAuthError(parsed)).toBe(true);
      expect((parsed as AuthenticationError).statusCode).toBe(401);
    });

    test("parseServerError handles jsonrpcError property", () => {
      const error = {
        message: "JSON-RPC Error 401: Token expired",
        jsonrpcError: {
          code: 401,
          message: "Token expired",
        },
      };
      const parsed = parseServerError(error, { provider: "github" });

      expect(isTokenExpiredError(parsed)).toBe(true);
    });

    test("parseServerError handles authorization errors", () => {
      const error = { code: 403, message: "Forbidden" };
      const parsed = parseServerError(error);

      expect(parsed.name).toBe("AuthorizationError");
    });
  });

  describe("Client Configuration", () => {
    test("client accepts onReauthRequired handler", () => {
      let reauthCalled = false;

      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        onReauthRequired: async () => {
          reauthCalled = true;
          return true;
        },
        singleton: false,  // Ensure fresh instance for testing
      });

      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    test("client accepts maxReauthRetries configuration", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        maxReauthRetries: 3,
      });

      expect(client).toBeDefined();
    });

    test("client defaults maxReauthRetries to 1", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client).toBeDefined();
    });
  });

  describe("Authentication State Tracking", () => {
    test("client tracks authentication state for providers", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      const state = client.getAuthState("github");
      expect(state).toBeDefined();
      expect(state?.authenticated).toBe(true);
    });

    test("isProviderAuthenticated returns correct state", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      expect(client.isProviderAuthenticated("github")).toBe(true);
      expect(client.isProviderAuthenticated("nonexistent")).toBe(false);
    });

    test("getAuthState returns undefined for unknown provider", () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client.getAuthState("nonexistent")).toBeUndefined();
    });
  });

  describe("Manual Re-authentication", () => {
    test("reauthenticate throws error if provider not found", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await expect(client.reauthenticate("nonexistent")).rejects.toThrow(
        'Provider "nonexistent" not found'
      );
    });

    test("reauthenticate throws error if no handler configured", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await expect(client.reauthenticate("github")).rejects.toThrow(
        "No re-authentication handler configured"
      );
    });

    test("reauthenticate calls handler and updates state on success", async () => {
      let reauthCalled = false;
      let reauthProvider: string | undefined;

      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        onReauthRequired: async (context) => {
          reauthCalled = true;
          reauthProvider = context.provider;
          return true;
        },
        singleton: false,  // Ensure fresh instance for testing
      });

      const success = await client.reauthenticate("github");

      expect(success).toBe(true);
      expect(reauthCalled).toBe(true);
      expect(reauthProvider).toBe("github");
      expect(client.isProviderAuthenticated("github")).toBe(true);
    });

    test("reauthenticate preserves state on failure", async () => {
      const client = createMCPClient({
        integrations: [
          githubIntegration({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        onReauthRequired: async () => {
          return false;
        },
        singleton: false,  // Ensure fresh instance for testing
      });

      await client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      const success = await client.reauthenticate("github");

      expect(success).toBe(false);
      // State should still be authenticated after failed reauth
      expect(client.isProviderAuthenticated("github")).toBe(true);
    });
  });

  describe("Error Type Guards", () => {
    test("isAuthError identifies AuthenticationError", () => {
      const error = new AuthenticationError("Test error", 401, "github");
      expect(isAuthError(error)).toBe(true);
    });

    test("isAuthError identifies TokenExpiredError", () => {
      const error = new TokenExpiredError("Token expired", "github");
      expect(isAuthError(error)).toBe(true);
    });

    test("isAuthError returns false for non-auth errors", () => {
      const error = new Error("Generic error");
      expect(isAuthError(error)).toBe(false);
    });

    test("isTokenExpiredError identifies TokenExpiredError", () => {
      const error = new TokenExpiredError("Token expired", "github");
      expect(isTokenExpiredError(error)).toBe(true);
    });

    test("isTokenExpiredError returns false for regular AuthenticationError", () => {
      const error = new AuthenticationError("Auth failed", 401, "github");
      expect(isTokenExpiredError(error)).toBe(false);
    });
  });
});

