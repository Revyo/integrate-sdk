/**
 * Tests for OAuth Route Adapters
 * Tests base handler, Next.js adapter, and TanStack Start adapter
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  OAuthHandler,
  type OAuthHandlerConfig,
  type AuthorizeRequest,
  type CallbackRequest,
} from "../../src/adapters/base-handler";

describe("OAuthHandler", () => {
  let config: OAuthHandlerConfig;
  let handler: OAuthHandler;

  beforeEach(() => {
    config = {
      providers: {
        github: {
          clientId: "github-client-id",
          clientSecret: "github-client-secret",
          redirectUri: "https://app.com/callback",
        },
        gmail: {
          clientId: "gmail-client-id",
          clientSecret: "gmail-client-secret",
        },
      },
    };
    handler = new OAuthHandler(config);
  });

  describe("handleAuthorize", () => {
    it("should get authorization URL for configured provider", async () => {
      // Mock fetch for MCP server response
      const mockFetch = mock(async (url: string, options?: any) => {
        expect(url).toContain("/oauth/authorize");
        expect(url).toContain("provider=github");
        expect(url).toContain("client_id=github-client-id");
        expect(url).toContain("client_secret=github-client-secret");

        return {
          ok: true,
          json: async () => ({
            authorizationUrl: "https://github.com/login/oauth/authorize?...",
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo", "user"],
        state: "random-state",
        codeChallenge: "challenge-123",
        codeChallengeMethod: "S256",
      };

      const result = await handler.handleAuthorize(request);

      expect(result.authorizationUrl).toContain("github.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should throw error for unconfigured provider", async () => {
      const request: AuthorizeRequest = {
        provider: "slack",
        scopes: ["chat:write"],
        state: "random-state",
        codeChallenge: "challenge-123",
        codeChallengeMethod: "S256",
      };

      await expect(handler.handleAuthorize(request)).rejects.toThrow(
        "Provider slack not configured"
      );
    });

    it("should include redirectUri in request when provided", async () => {
      const mockFetch = mock(async (url: string) => {
        expect(url).toContain("redirect_uri=https%3A%2F%2Fcustom.com%2Fcallback");

        return {
          ok: true,
          json: async () => ({
            authorizationUrl: "https://github.com/login/oauth/authorize",
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        redirectUri: "https://custom.com/callback",
      };

      await handler.handleAuthorize(request);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should use provider default redirectUri when not in request", async () => {
      const mockFetch = mock(async (url: string) => {
        expect(url).toContain("redirect_uri=https%3A%2F%2Fapp.com%2Fcallback");

        return {
          ok: true,
          json: async () => ({
            authorizationUrl: "https://github.com/login/oauth/authorize",
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
      };

      await handler.handleAuthorize(request);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should throw error when MCP server fails", async () => {
      const mockFetch = mock(async () => {
        return {
          ok: false,
          text: async () => "Server error",
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
      };

      await expect(handler.handleAuthorize(request)).rejects.toThrow(
        "MCP server failed to generate authorization URL"
      );
    });
  });

  describe("handleCallback", () => {
    it("should exchange code for access token", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        expect(url).toContain("/oauth/callback");

        const body = JSON.parse(options?.body);
        expect(body.provider).toBe("github");
        expect(body.code).toBe("auth-code-123");
        expect(body.code_verifier).toBe("verifier-123");
        expect(body.client_id).toBe("github-client-id");
        expect(body.client_secret).toBe("github-client-secret");

        return {
          ok: true,
          json: async () => ({
            accessToken: "gho_123456",
            tokenType: "Bearer",
            expiresIn: 28800,
            scopes: ["repo", "user"],
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: CallbackRequest = {
        provider: "github",
        code: "auth-code-123",
        codeVerifier: "verifier-123",
        state: "state-123",
      };

      const result = await handler.handleCallback(request);

      expect(result.accessToken).toBe("gho_123456");
      expect(result.tokenType).toBe("Bearer");
      expect(result.expiresIn).toBe(28800);
      expect(result.scopes).toEqual(["repo", "user"]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should send all required OAuth credentials including redirect_uri", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        expect(url).toContain("/oauth/callback");
        expect(options?.method).toBe("POST");
        expect(options?.headers?.["Content-Type"]).toBe("application/json");

        const body = JSON.parse(options?.body);
        
        // Verify all required OAuth parameters are present
        expect(body.provider).toBe("github");
        expect(body.code).toBe("auth-code-123");
        expect(body.code_verifier).toBe("verifier-123");
        expect(body.state).toBe("state-123");
        
        // Verify all three OAuth credentials are sent
        expect(body.client_id).toBe("github-client-id");
        expect(body.client_secret).toBe("github-client-secret");
        expect(body.redirect_uri).toBe("https://app.com/callback");

        return {
          ok: true,
          json: async () => ({
            accessToken: "gho_123456",
            tokenType: "Bearer",
            expiresIn: 28800,
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: CallbackRequest = {
        provider: "github",
        code: "auth-code-123",
        codeVerifier: "verifier-123",
        state: "state-123",
      };

      await handler.handleCallback(request);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw error when MCP server fails", async () => {
      const mockFetch = mock(async () => {
        return {
          ok: false,
          text: async () => "Invalid authorization code",
        } as Response;
      });

      global.fetch = mockFetch as any;

      const request: CallbackRequest = {
        provider: "github",
        code: "invalid-code",
        codeVerifier: "verifier",
        state: "state",
      };

      await expect(handler.handleCallback(request)).rejects.toThrow(
        "MCP server failed to exchange authorization code"
      );
    });

    it("should throw error for unconfigured provider", async () => {
      const request: CallbackRequest = {
        provider: "slack",
        code: "code-123",
        codeVerifier: "verifier",
        state: "state",
      };

      await expect(handler.handleCallback(request)).rejects.toThrow(
        "Provider slack not configured"
      );
    });
  });

  describe("handleStatus", () => {
    it("should check authorization status for provider", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        expect(url).toContain("/oauth/status");
        expect(url).toContain("provider=github");
        expect(options?.headers?.["Authorization"]).toBe("Bearer token-123");

        return {
          ok: true,
          json: async () => ({
            authorized: true,
            scopes: ["repo", "user"],
            expiresAt: "2024-12-31T23:59:59Z",
          }),
        } as Response;
      });

      global.fetch = mockFetch as any;

      const result = await handler.handleStatus("github", "token-123");

      expect(result.authorized).toBe(true);
      expect(result.scopes).toEqual(["repo", "user"]);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should return not authorized when status is 401", async () => {
      const mockFetch = mock(async () => {
        return {
          ok: false,
          status: 401,
        } as Response;
      });

      global.fetch = mockFetch as any;

      const result = await handler.handleStatus("github", "invalid-token");

      expect(result.authorized).toBe(false);
    });

    it("should throw error when MCP server fails with non-401", async () => {
      const mockFetch = mock(async () => {
        return {
          ok: false,
          status: 500,
          text: async () => "Internal server error",
        } as Response;
      });

      global.fetch = mockFetch as any;

      await expect(
        handler.handleStatus("github", "token-123")
      ).rejects.toThrow("MCP server failed to check authorization status");
    });
  });

  describe("Configuration Validation", () => {
    it("should throw error for provider with missing clientId", async () => {
      const badConfig: OAuthHandlerConfig = {
        providers: {
          github: {
            clientId: "",
            clientSecret: "secret",
          },
        },
      };

      const badHandler = new OAuthHandler(badConfig);

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
      };

      await expect(badHandler.handleAuthorize(request)).rejects.toThrow(
        "Missing OAuth credentials for github"
      );
    });

    it("should throw error for provider with missing clientSecret", async () => {
      const badConfig: OAuthHandlerConfig = {
        providers: {
          github: {
            clientId: "client-id",
            clientSecret: "",
          },
        },
      };

      const badHandler = new OAuthHandler(badConfig);

      const request: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
      };

      await expect(badHandler.handleAuthorize(request)).rejects.toThrow(
        "Missing OAuth credentials for github"
      );
    });
  });

  describe("Multiple Providers", () => {
    it("should handle requests for different providers", async () => {
      const mockFetch = mock(async (url: string) => {
        if (url.includes("provider=github")) {
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://github.com/oauth",
            }),
          } as Response;
        } else if (url.includes("provider=gmail")) {
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://accounts.google.com/oauth",
            }),
          } as Response;
        }
        return { ok: false } as Response;
      });

      global.fetch = mockFetch as any;

      const githubRequest: AuthorizeRequest = {
        provider: "github",
        scopes: ["repo"],
        state: "state1",
        codeChallenge: "challenge1",
        codeChallengeMethod: "S256",
      };

      const gmailRequest: AuthorizeRequest = {
        provider: "gmail",
        scopes: ["gmail.readonly"],
        state: "state2",
        codeChallenge: "challenge2",
        codeChallengeMethod: "S256",
      };

      const githubResult = await handler.handleAuthorize(githubRequest);
      const gmailResult = await handler.handleAuthorize(gmailRequest);

      expect(githubResult.authorizationUrl).toContain("github");
      expect(gmailResult.authorizationUrl).toContain("google");
    });
  });
});

