/**
 * Database Token Callbacks Tests
 * Tests for server-side database token storage via callbacks
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { OAuthManager } from "../../src/oauth/manager.js";
import type { ProviderTokenData } from "../../src/oauth/types.js";

// Mock OAuth API base
const TEST_OAUTH_API_BASE = "/api/integrate/oauth";

describe("Database Token Callbacks", () => {
  describe("OAuthManager with token callbacks", () => {
    test("uses getProviderToken callback when provided", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "db-token-123",
        tokenType: "Bearer",
        expiresIn: 3600,
        scopes: ["repo", "user"],
      };

      const getTokenMock = mock(async (provider: string) => {
        if (provider === "github") {
          return mockTokenData;
        }
        return undefined;
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      const token = await manager.getProviderToken("github");
      
      expect(getTokenMock).toHaveBeenCalledWith("github", undefined);
      expect(token).toEqual(mockTokenData);
    });

    test("uses setProviderToken callback when provided", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "new-token-456",
        tokenType: "Bearer",
        expiresIn: 7200,
        refreshToken: "refresh-789",
      };

      const setTokenMock = mock(async (provider: string, tokenData: ProviderTokenData) => {
        // Simulate database save
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          setProviderToken: setTokenMock,
        }
      );

      await manager.setProviderToken("github", mockTokenData);
      
      expect(setTokenMock).toHaveBeenCalledWith("github", mockTokenData, undefined);
    });

    test("loads all provider tokens using callback", async () => {
      const mockTokens: Record<string, ProviderTokenData> = {
        github: {
          accessToken: "github-token",
          tokenType: "Bearer",
          expiresIn: 3600,
        },
        gmail: {
          accessToken: "gmail-token",
          tokenType: "Bearer",
          expiresIn: 3600,
        },
      };

      const getTokenMock = mock(async (provider: string) => {
        return mockTokens[provider];
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      await manager.loadAllProviderTokens(["github", "gmail"]);
      
      expect(getTokenMock).toHaveBeenCalledTimes(2);
      // loadAllProviderTokens doesn't pass context, so both should be called without it
      expect(getTokenMock).toHaveBeenCalledWith("github");
      expect(getTokenMock).toHaveBeenCalledWith("gmail");

      // Verify tokens are loaded in memory
      const allTokens = manager.getAllProviderTokens();
      expect(allTokens.size).toBe(2);
      expect(allTokens.get("github")).toEqual(mockTokens.github);
      expect(allTokens.get("gmail")).toEqual(mockTokens.gmail);
    });

    test("checkAuthStatus uses callback to check token existence", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "token",
        tokenType: "Bearer",
        expiresIn: 3600,
        scopes: ["repo"],
        expiresAt: "2024-12-31T23:59:59Z",
      };

      const getTokenMock = mock(async (provider: string) => {
        return provider === "github" ? mockTokenData : undefined;
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      const statusAuthorized = await manager.checkAuthStatus("github");
      expect(statusAuthorized.authorized).toBe(true);
      expect(statusAuthorized.provider).toBe("github");
      expect(statusAuthorized.scopes).toEqual(["repo"]);
      expect(statusAuthorized.expiresAt).toBe("2024-12-31T23:59:59Z");

      const statusUnauthorized = await manager.checkAuthStatus("gitlab");
      expect(statusUnauthorized.authorized).toBe(false);
      expect(statusUnauthorized.provider).toBe("gitlab");
    });

    test("disconnectProvider uses callback to check token before disconnect", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      const getTokenMock = mock(async (provider: string) => {
        return provider === "github" ? mockTokenData : undefined;
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      await manager.disconnectProvider("github");
      
      expect(getTokenMock).toHaveBeenCalledWith("github", undefined);
    });

    test("handles callback errors gracefully in getProviderToken", async () => {
      const getTokenMock = mock(async (provider: string) => {
        throw new Error("Database connection failed");
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      const token = await manager.getProviderToken("github");
      
      expect(token).toBeUndefined();
    });

    test("handles callback errors in setProviderToken", async () => {
      const setTokenMock = mock(async (provider: string, tokenData: ProviderTokenData) => {
        throw new Error("Database write failed");
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          setProviderToken: setTokenMock,
        }
      );

      const mockTokenData: ProviderTokenData = {
        accessToken: "token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      await expect(
        manager.setProviderToken("github", mockTokenData)
      ).rejects.toThrow("Database write failed");
    });

    test("does not use localStorage when callbacks are provided", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "db-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      const getTokenMock = mock(async (provider: string) => mockTokenData);
      const setTokenMock = mock(async (provider: string, tokenData: ProviderTokenData) => {});

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
          setProviderToken: setTokenMock,
        }
      );

      // Set a token
      await manager.setProviderToken("github", mockTokenData);

      // Verify callback was used (setProviderToken now includes context parameter)
      expect(setTokenMock).toHaveBeenCalledWith("github", mockTokenData, undefined);

      // Clear the token
      manager.clearProviderToken("github");

      // When using callbacks, clearProviderToken should only clear in-memory cache
      // It should not interact with localStorage
      const token = await manager.getProviderToken("github");
      
      // Token should still be in database (callback returns it)
      expect(token).toEqual(mockTokenData);
    });

    test("supports synchronous callbacks", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "sync-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      // Synchronous callback (not async)
      const getTokenMock = mock((provider: string) => {
        return provider === "github" ? mockTokenData : undefined;
      });

      const setTokenMock = mock((provider: string, tokenData: ProviderTokenData) => {
        // Synchronous save
      });

      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
          setProviderToken: setTokenMock,
        }
      );

      // Should work with synchronous callbacks
      const token = await manager.getProviderToken("github");
      expect(token).toEqual(mockTokenData);

      await manager.setProviderToken("github", mockTokenData);
      expect(setTokenMock).toHaveBeenCalledWith("github", mockTokenData, undefined);
    });

    test("falls back to localStorage when callbacks are not provided", async () => {
      const manager = new OAuthManager(TEST_OAUTH_API_BASE);

      const mockTokenData: ProviderTokenData = {
        accessToken: "local-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      // Set token without callback (should use localStorage)
      await manager.setProviderToken("github", mockTokenData);

      // Get token without callback (should read from in-memory cache)
      const token = await manager.getProviderToken("github");
      
      // Should retrieve from in-memory cache
      expect(token).toEqual(mockTokenData);
    });

    test("can use getProviderToken without setProviderToken (read-only)", async () => {
      const mockTokenData: ProviderTokenData = {
        accessToken: "readonly-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      };

      const getTokenMock = mock(async (provider: string) => {
        return provider === "github" ? mockTokenData : undefined;
      });

      // Only provide getProviderToken, not setProviderToken
      const manager = new OAuthManager(
        TEST_OAUTH_API_BASE,
        undefined,
        undefined,
        {
          getProviderToken: getTokenMock,
        }
      );

      const token = await manager.getProviderToken("github");
      expect(token).toEqual(mockTokenData);

      // Setting should work (updates in-memory cache)
      const newTokenData: ProviderTokenData = {
        accessToken: "new-token",
        tokenType: "Bearer",
        expiresIn: 7200,
      };

      // This should not throw, but won't persist to database
      await manager.setProviderToken("github", newTokenData);
      
      // Should update in-memory cache
      const allTokens = manager.getAllProviderTokens();
      expect(allTokens.get("github")).toEqual(newTokenData);
    });
  });
});

