/**
 * Tests for OAuth Route Adapters
 * Tests base handler, Next.js adapter, and TanStack Start adapter
 */

import { describe, it, expect, beforeEach, mock, beforeAll, afterAll } from "bun:test";
import {
  OAuthHandler,
  type OAuthHandlerConfig,
  type AuthorizeRequest,
  type CallbackRequest,
} from "../../src/adapters/base-handler";
import { createNextOAuthHandler } from "../../src/adapters/nextjs";
import { createMCPServer, toNextJsHandler } from "../../src/server";

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

describe("Next.js Catch-All Route Handler", () => {
  let config: OAuthHandlerConfig;
  let handler: ReturnType<typeof createNextOAuthHandler>;

  beforeEach(() => {
    config = {
      providers: {
        github: {
          clientId: "github-client-id",
          clientSecret: "github-client-secret",
          redirectUri: "https://app.com/api/integrate/oauth/callback",
        },
      },
    };
    handler = createNextOAuthHandler(config);
  });

  describe("toNextJsHandler", () => {
    it("should handle POST /oauth/authorize", async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorizationUrl: "https://github.com/login/oauth/authorize",
        }),
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          provider: "github",
          scopes: ["repo"],
          state: "state-123",
          codeChallenge: "challenge-123",
          codeChallengeMethod: "S256",
        }),
      } as any;

      const context = { params: { all: ["oauth", "authorize"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(data.authorizationUrl).toContain("github");
    });

    it("should handle POST /oauth/callback", async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        json: async () => ({
          accessToken: "gho_123456",
          tokenType: "Bearer",
          expiresIn: 28800,
        }),
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          provider: "github",
          code: "code-123",
          codeVerifier: "verifier-123",
          state: "state-123",
        }),
      } as any;

      const context = { params: { all: ["oauth", "callback"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(data.accessToken).toBe("gho_123456");
    });

    it("should handle POST /oauth/disconnect", async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          provider: "github",
        }),
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({ provider: "github" }),
        headers: {
          get: (key: string) => {
            if (key === "authorization") return "Bearer token-123";
            return null;
          },
        },
      } as any;

      const context = { params: { all: ["oauth", "disconnect"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(data.success).toBe(true);
    });

    it("should handle GET /oauth/status", async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorized: true,
          scopes: ["repo"],
        }),
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        nextUrl: {
          searchParams: new URLSearchParams("provider=github"),
        },
        headers: {
          get: (key: string) => {
            if (key === "authorization") return "Bearer token-123";
            return null;
          },
        },
      } as any;

      const context = { params: { all: ["oauth", "status"] } };
      const response = await routes.GET(mockRequest, context);
      const data = await response.json();

      expect(data.authorized).toBe(true);
    });

    it("should handle GET /oauth/callback (provider redirect)", async () => {
      const routes = handler.toNextJsHandler({
        redirectUrl: "/dashboard",
      });

      const mockRequest = {
        url: "https://app.com/api/integrate/oauth/callback?code=code-123&state=eyJzdGF0ZSI6InN0YXRlLTEyMyIsInJldHVyblVybCI6Ii9kYXNoYm9hcmQifQ",
        headers: {
          get: () => null,
        },
      } as any;

      const context = { params: { all: ["oauth", "callback"] } };
      const response = await routes.GET(mockRequest, context);

      expect(response.status).toBe(302); // Redirect status
      const location = response.headers.get("Location");
      expect(location).toBeTruthy();
    });

    it("should handle GET /oauth/callback with error parameter", async () => {
      const routes = handler.toNextJsHandler({
        errorRedirectUrl: "/auth-error",
      });

      const mockRequest = {
        url: "https://app.com/api/integrate/oauth/callback?error=access_denied&error_description=User%20denied%20access",
        headers: {
          get: () => null,
        },
      } as any;

      const context = { params: { all: ["oauth", "callback"] } };
      const response = await routes.GET(mockRequest, context);

      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      expect(location).toContain("/auth-error");
      expect(location).toContain("error=");
    });

    it("should return 404 for unknown POST action", async () => {
      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({}),
      } as any;

      const context = { params: { all: ["oauth", "unknown"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Unknown action");
    });

    it("should return 404 for unknown GET action", async () => {
      const routes = handler.toNextJsHandler();
      const mockRequest = {
        nextUrl: {
          searchParams: new URLSearchParams(),
        },
      } as any;

      const context = { params: { all: ["oauth", "unknown"] } };
      const response = await routes.GET(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Unknown action");
    });

    it("should return 404 for invalid route path", async () => {
      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({}),
      } as any;

      const context = { params: { all: ["invalid", "path"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Invalid route");
    });

    it("should handle async params (Next.js 15+)", async () => {
      const mockFetch = mock(async () => ({
        ok: true,
        json: async () => ({
          authorizationUrl: "https://github.com/login/oauth/authorize",
        }),
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          provider: "github",
          scopes: ["repo"],
          state: "state-123",
          codeChallenge: "challenge-123",
          codeChallengeMethod: "S256",
        }),
      } as any;

      // Simulate Next.js 15+ async params
      const context = {
        params: Promise.resolve({ all: ["oauth", "authorize"] })
      };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(data.authorizationUrl).toContain("github");
    });

    it("should use default redirect URLs when not configured", async () => {
      const routes = handler.toNextJsHandler();

      const mockRequest = {
        url: "https://app.com/api/integrate/oauth/callback?code=code-123&state=eyJzdGF0ZSI6InN0YXRlLTEyMyJ9",
        headers: {
          get: () => null,
        },
      } as any;

      const context = { params: { all: ["oauth", "callback"] } };
      const response = await routes.GET(mockRequest, context);

      expect(response.status).toBe(302);
      const location = response.headers.get("Location");
      // Should use default '/' redirect
      expect(location).toBeTruthy();
    });
  });
});

describe("Server-Side toNextJsHandler", () => {
  beforeAll(() => {
    // Mock window to be undefined so createMCPServer thinks it's server-side
    (global as any).window = undefined;
  });

  afterAll(() => {
    // Clean up
    delete (global as any).window;
  });

  it("should use global server config from createMCPServer", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        authorizationUrl: "https://github.com/login/oauth/authorize",
      }),
    })) as any;

    global.fetch = mockFetch;

    // Create server config (this registers global config)
    const mockPlugin = {
      id: "github",
      tools: [],
      oauth: {
        clientId: "server-github-id",
        clientSecret: "server-github-secret",
        redirectUri: "https://app.com/api/integrate/oauth/callback",
      },
    };

    createMCPServer({
      plugins: [mockPlugin as any],
    });

    // Create catch-all routes using the global config
    const routes = toNextJsHandler({
      redirectUrl: "/dashboard",
    });

    const mockRequest = {
      json: async () => ({
        provider: "github",
        scopes: ["repo"],
        state: "state-123",
        codeChallenge: "challenge-123",
        codeChallengeMethod: "S256",
      }),
    } as any;

    const context = { params: { all: ["oauth", "authorize"] } };
    const response = await routes.POST(mockRequest, context);
    const data = await response.json();

    expect(data.authorizationUrl).toContain("github");
  });

  it("should handle POST /oauth/callback", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        accessToken: "gho_123456",
        tokenType: "Bearer",
        expiresIn: 28800,
      }),
    })) as any;

    global.fetch = mockFetch;

    const routes = toNextJsHandler();
    const mockRequest = {
      json: async () => ({
        provider: "github",
        code: "code-123",
        codeVerifier: "verifier-123",
        state: "state-123",
      }),
    } as any;

    const context = { params: { all: ["oauth", "callback"] } };
    const response = await routes.POST(mockRequest, context);
    const data = await response.json();

    expect(data.accessToken).toBe("gho_123456");
  });

  it("should handle GET /oauth/callback (provider redirect)", async () => {
    const routes = toNextJsHandler({
      redirectUrl: "/dashboard",
    });

    const mockRequest = {
      url: "https://app.com/api/integrate/oauth/callback?code=code-123&state=eyJzdGF0ZSI6InN0YXRlLTEyMyIsInJldHVyblVybCI6Ii9kYXNoYm9hcmQifQ",
      headers: {
        get: () => null,
      },
    } as any;

    const context = { params: { all: ["oauth", "callback"] } };
    const response = await routes.GET(mockRequest, context);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toBeTruthy();
  });

  it("should handle async params (Next.js 15+)", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        authorized: true,
        scopes: ["repo"],
      }),
    })) as any;

    global.fetch = mockFetch;

    const routes = toNextJsHandler();
    const mockRequest = {
      nextUrl: {
        searchParams: new URLSearchParams("provider=github"),
      },
      headers: {
        get: (key: string) => {
          if (key === "authorization") return "Bearer token-123";
          return null;
        },
      },
    } as any;

    // Simulate Next.js 15+ async params
    const context = {
      params: Promise.resolve({ all: ["oauth", "status"] })
    };
    const response = await routes.GET(mockRequest, context);
    const data = await response.json();

    expect(data.authorized).toBe(true);
  });
});

