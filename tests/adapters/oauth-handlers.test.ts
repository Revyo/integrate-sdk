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

    it("should handle POST /mcp (MCP tool call)", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        // handleToolCall sends JSON-RPC request to MCP server
        if (url.includes("/api/v1/mcp")) {
          return {
            ok: true,
            json: async () => ({
              jsonrpc: "2.0",
              id: 1,
              result: {
                content: [
                  {
                    type: "text",
                    text: '{"repos": [{"name": "repo1"}]}',
                  },
                ],
                isError: false,
              },
            }),
          } as Response;
        }
        return { ok: false } as Response;
      }) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          name: "github_list_own_repos",
          arguments: {},
        }),
        headers: {
          get: (key: string) => {
            if (key === "authorization") return "Bearer github-token-123";
            return null;
          },
        },
      } as any;

      const context = { params: { all: ["mcp"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toHaveLength(1);
      expect(data.content[0].type).toBe("text");
      expect(data.content[0].text).toContain("repo1");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle POST /mcp without Authorization header", async () => {
      const mockFetch = mock(async (url: string) => {
        if (url.includes("/api/v1/mcp")) {
          return {
            ok: true,
            json: async () => ({
              jsonrpc: "2.0",
              id: 1,
              result: {
                content: [{ type: "text", text: "result" }],
              },
            }),
          } as Response;
        }
        return { ok: false } as Response;
      }) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          name: "server_tool",
          arguments: {},
        }),
        headers: {
          get: () => null,
        },
      } as any;

      const context = { params: { all: ["mcp"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle POST /mcp with error response", async () => {
      const mockFetch = mock(async () => ({
        ok: false,
        status: 500,
        text: async () => "Tool execution failed",
      })) as any;

      global.fetch = mockFetch;

      const routes = handler.toNextJsHandler();
      const mockRequest = {
        json: async () => ({
          name: "github_list_own_repos",
          arguments: {},
        }),
        headers: {
          get: () => "Bearer token",
        },
      } as any;

      const context = { params: { all: ["mcp"] } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Tool execution failed");
    });

    it("should handle mcp action in createRoutes()", async () => {
      const mockFetch = mock(async (url: string) => {
        if (url.includes("/api/v1/mcp")) {
          return {
            ok: true,
            json: async () => ({
              jsonrpc: "2.0",
              id: 1,
              result: {
                content: [{ type: "text", text: "result" }],
              },
            }),
          } as Response;
        }
        return { ok: false } as Response;
      }) as any;

      global.fetch = mockFetch;

      const routes = handler.createRoutes();
      const mockRequest = {
        json: async () => ({
          name: "github_list_own_repos",
          arguments: {},
        }),
        headers: {
          get: () => "Bearer token",
        },
      } as any;

      const context = { params: { action: "mcp" } };
      const response = await routes.POST(mockRequest, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
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
  let testClient: any;

  beforeAll(() => {
    // Mock window to be undefined so createMCPServer thinks it's server-side
    (global as any).window = undefined;

    // Set up server config once for all tests
    const mockIntegration = {
      id: "github",
      tools: [],
      oauth: {
        clientId: "test-github-id",
        clientSecret: "test-github-secret",
        redirectUri: "https://app.com/api/integrate/oauth/callback",
      },
    };

    const { client } = createMCPServer({
      integrations: [mockIntegration as any],
    });

    testClient = client;
  });

  afterAll(() => {
    // Clean up
    delete (global as any).window;
  });

  it("should use imported client from createMCPServer", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        authorizationUrl: "https://github.com/login/oauth/authorize",
      }),
    })) as any;

    global.fetch = mockFetch;

    // Create catch-all routes by passing client
    const routes = toNextJsHandler(testClient, {
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

    const routes = toNextJsHandler(testClient);
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
    const routes = toNextJsHandler(testClient, {
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

    const routes = toNextJsHandler(testClient);
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

  it("should allow manual config override", async () => {
    const mockFetch = mock(async () => ({
      ok: true,
      json: async () => ({
        authorizationUrl: "https://github.com/login/oauth/authorize?client_id=manual-client-id",
      }),
    })) as any;

    global.fetch = mockFetch;

    // Use manual config instead of global server config
    const routes = toNextJsHandler({
      providers: {
        github: {
          clientId: "manual-client-id",
          clientSecret: "manual-client-secret",
          redirectUri: "https://manual.com/callback",
        },
      },
      redirectUrl: "/custom-redirect",
    });

    const mockRequest = {
      json: async () => ({
        provider: "github",
        scopes: ["repo", "user"],
        redirectUri: "https://manual.com/callback",
      }),
    } as any;

    const context = { params: { all: ["oauth", "authorize"] } };
    const response = await routes.POST(mockRequest, context);
    const data = await response.json();

    expect(data.authorizationUrl).toContain("manual-client-id");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle POST /mcp route from server-side handler", async () => {
    const mockFetch = mock(async (url: string) => {
      if (url.includes("/api/v1/mcp")) {
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [{ type: "text", text: "tool result" }],
            },
          }),
          text: async () => "error text",
        } as Response;
      }
      return { ok: false, text: async () => "error" } as Response;
    }) as any;

    global.fetch = mockFetch;

    const routes = toNextJsHandler(testClient);
    const mockRequest = {
      json: async () => ({
        name: "github_list_own_repos",
        arguments: {},
      }),
      headers: {
        get: (key: string) => {
          if (key === "authorization") return "Bearer github-token-123";
          return null;
        },
      },
    } as any;

    const context = { params: { all: ["mcp"] } };
    const response = await routes.POST(mockRequest, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should handle POST /mcp route via unified handler (for Astro/Remix)", async () => {
    let apiKeyUsed: string | undefined;

    const mockFetch = mock(async (url: string, options?: any) => {
      if (url.includes("/api/v1/mcp")) {
        // Capture the API key to verify it's being passed
        apiKeyUsed = options?.headers?.["X-API-KEY"];
        return {
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: {
              content: [{ type: "text", text: "unified handler result" }],
            },
          }),
          text: async () => "error text",
        } as Response;
      }
      return { ok: false, text: async () => "error" } as Response;
    }) as any;

    global.fetch = mockFetch;

    // Create a fresh server with API key for this test
    (global as any).window = undefined; // Ensure server-side mode

    const { client } = createMCPServer({
      apiKey: "test-api-key-unified",
      integrations: [{
        id: "github",
        tools: [],
        oauth: {
          clientId: "test-id",
          clientSecret: "test-secret",
          provider: "github",
        },
      }] as any,
    });

    // Create a request that mimics Astro/Remix routing
    const mockRequest = {
      url: "http://localhost:3000/api/integrate/mcp",
      method: "POST",
      headers: {
        get: (key: string) => {
          if (key === "authorization") return "Bearer github-token-123";
          return null;
        },
      },
      json: async () => ({
        name: "github_list_own_repos",
        arguments: {},
      }),
    } as any;

    // Call the unified handler directly with params (use client.handler)
    const response = await (client as any).handler(mockRequest, { params: { all: ["mcp"] } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toHaveLength(1);
    expect(data.content[0].text).toBe("unified handler result");
    expect(apiKeyUsed).toBe("test-api-key-unified");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("SvelteKit Handler - toSvelteKitHandler", () => {
  describe("Pattern 1: Handler function (recommended)", () => {
    it("should wrap handler from createMCPServer", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/authorize")) {
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://github.com/login/oauth/authorize",
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      // Make sure we're in server mode
      (global as any).window = undefined;

      const { client } = createMCPServer({
        integrations: [{
          id: "github",
          tools: [],
          oauth: {
            clientId: "test-id",
            clientSecret: "test-secret",
            provider: "github",
          },
        }] as any,
      });

      // Import and use toSvelteKitHandler
      const { toSvelteKitHandler } = await import("../../src/server");
      const svelteKitHandler = toSvelteKitHandler(client, {
        redirectUrl: "/dashboard",
        errorRedirectUrl: "/error",
      });

      // Create a mock SvelteKit event
      const mockEvent = {
        request: {
          url: "http://localhost:5173/api/integrate/oauth/authorize",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            scopes: ["repo"],
            state: "test-state",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
          }),
        } as any,
        params: {
          all: ["oauth", "authorize"],
        },
      };

      const response = await svelteKitHandler(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorizationUrl).toContain("github.com");
    });
  });

  describe("Pattern 2: Inline configuration", () => {
    it("should accept providers config directly", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/authorize")) {
          expect(url).toContain("provider=github");
          expect(url).toContain("client_id=test-client-id");
          expect(url).toContain("client_secret=test-client-secret");
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://github.com/login/oauth/authorize",
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      // Import toSvelteKitHandler
      const { toSvelteKitHandler } = await import("../../src/server");

      // Create handler with inline config (like the example)
      const svelteKitHandler = toSvelteKitHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
        redirectUrl: "/dashboard",
        errorRedirectUrl: "/error",
      });

      // Create a mock SvelteKit event
      const mockEvent = {
        request: {
          url: "http://localhost:5173/api/integrate/oauth/authorize",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            scopes: ["repo"],
            state: "test-state",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
          }),
        } as any,
        params: {
          all: ["oauth", "authorize"],
        },
      };

      const response = await svelteKitHandler(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorizationUrl).toContain("github.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle callback with inline config", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/callback")) {
          return {
            ok: true,
            json: async () => ({
              accessToken: "test-token",
              tokenType: "Bearer",
              expiresIn: 3600,
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      const { toSvelteKitHandler } = await import("../../src/server");

      const svelteKitHandler = toSvelteKitHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      });

      const mockEvent = {
        request: {
          url: "http://localhost:5173/api/integrate/oauth/callback",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            code: "test-code",
            codeVerifier: "verifier",
            state: "test-state",
          }),
        } as any,
        params: {
          all: ["oauth", "callback"],
        },
      };

      const response = await svelteKitHandler(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessToken).toBe("test-token");
    });

    it("should handle status check with inline config", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/status")) {
          return {
            ok: true,
            json: async () => ({
              authorized: true,
              scopes: ["repo"],
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      const { toSvelteKitHandler } = await import("../../src/server");

      const svelteKitHandler = toSvelteKitHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      });

      const mockUrl = new URL("http://localhost:5173/api/integrate/oauth/status?provider=github");
      const mockEvent = {
        request: {
          url: mockUrl.toString(),
          method: "GET",
          headers: {
            get: (key: string) => {
              if (key === "authorization") return "Bearer test-token";
              return null;
            },
          },
          // Add nextUrl property for Next.js compatibility
          nextUrl: {
            searchParams: mockUrl.searchParams,
          },
        } as any,
        params: {
          all: ["oauth", "status"],
        },
      };

      const response = await svelteKitHandler(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorized).toBe(true);
    });

    it("should throw error when providers config is missing", async () => {
      const { toSvelteKitHandler } = await import("../../src/server");

      expect(() => {
        toSvelteKitHandler({
          redirectUrl: "/dashboard",
        } as any);
      }).toThrow("toSvelteKitHandler requires either a handler function or a providers config object");
    });

    it("should handle GET /oauth/callback (provider redirect)", async () => {
      const { toSvelteKitHandler } = await import("../../src/server");

      const svelteKitHandler = toSvelteKitHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
        redirectUrl: "/dashboard",
      });

      const mockEvent = {
        request: {
          url: "http://localhost:5173/api/integrate/oauth/callback?code=test-code&state=test-state",
          method: "GET",
          headers: {
            get: () => null,
          },
        } as any,
        params: {
          all: ["oauth", "callback"],
        },
      };

      const response = await svelteKitHandler(mockEvent);

      // Should redirect with OAuth callback in hash
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/dashboard");
      expect(location).toContain("oauth_callback");
    });
  });
});

describe("SolidStart Handler - toSolidStartHandler", () => {
  describe("Pattern 1: Handler function (recommended)", () => {
    it("should wrap handler from createMCPServer", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/authorize")) {
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://github.com/login/oauth/authorize",
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      // Make sure we're in server mode
      (global as any).window = undefined;

      const { client } = createMCPServer({
        integrations: [{
          id: "github",
          tools: [],
          oauth: {
            clientId: "test-id",
            clientSecret: "test-secret",
            provider: "github",
          },
        }] as any,
      });

      // Import and use toSolidStartHandler
      const { toSolidStartHandler } = await import("../../src/server");
      const handlers = toSolidStartHandler(client, {
        redirectUrl: "/dashboard",
        errorRedirectUrl: "/error",
      });

      // Create a mock SolidStart event
      const mockEvent = {
        request: {
          url: "http://localhost:3000/api/integrate/oauth/authorize",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            scopes: ["repo"],
            state: "test-state",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
          }),
        } as any,
      };

      const response = await handlers.POST(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorizationUrl).toContain("github.com");
    });
  });

  describe("Pattern 2: Inline configuration", () => {
    it("should accept providers config directly", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/authorize")) {
          expect(url).toContain("provider=github");
          expect(url).toContain("client_id=test-client-id");
          expect(url).toContain("client_secret=test-client-secret");
          return {
            ok: true,
            json: async () => ({
              authorizationUrl: "https://github.com/login/oauth/authorize",
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      // Import toSolidStartHandler
      const { toSolidStartHandler } = await import("../../src/server");

      // Create handler with inline config
      const handlers = toSolidStartHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
        redirectUrl: "/dashboard",
        errorRedirectUrl: "/error",
      });

      // Create a mock SolidStart event
      const mockEvent = {
        request: {
          url: "http://localhost:3000/api/integrate/oauth/authorize",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            scopes: ["repo"],
            state: "test-state",
            codeChallenge: "challenge",
            codeChallengeMethod: "S256",
          }),
        } as any,
      };

      const response = await handlers.POST(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorizationUrl).toContain("github.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle callback with inline config", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/callback")) {
          return {
            ok: true,
            json: async () => ({
              accessToken: "test-token",
              tokenType: "Bearer",
              expiresIn: 3600,
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      const { toSolidStartHandler } = await import("../../src/server");

      const handlers = toSolidStartHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      });

      const mockEvent = {
        request: {
          url: "http://localhost:3000/api/integrate/oauth/callback",
          method: "POST",
          headers: {
            get: () => null,
          },
          json: async () => ({
            provider: "github",
            code: "test-code",
            codeVerifier: "verifier",
            state: "test-state",
          }),
        } as any,
      };

      const response = await handlers.POST(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accessToken).toBe("test-token");
    });

    it("should handle status check with inline config", async () => {
      const mockFetch = mock(async (url: string, options?: any) => {
        if (url.includes("/oauth/status")) {
          return {
            ok: true,
            json: async () => ({
              authorized: true,
              scopes: ["repo"],
            }),
          } as Response;
        }
        return { ok: false, text: async () => "error" } as Response;
      }) as any;

      global.fetch = mockFetch;

      const { toSolidStartHandler } = await import("../../src/server");

      const handlers = toSolidStartHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      });

      const mockUrl = new URL("http://localhost:3000/api/integrate/oauth/status?provider=github");
      const mockEvent = {
        request: {
          url: mockUrl.toString(),
          method: "GET",
          headers: {
            get: (key: string) => {
              if (key === "authorization") return "Bearer test-token";
              return null;
            },
          },
          // Add nextUrl property for Next.js compatibility
          nextUrl: {
            searchParams: mockUrl.searchParams,
          },
        } as any,
      };

      const response = await handlers.GET(mockEvent);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authorized).toBe(true);
    });

    it("should throw error when providers config is missing", async () => {
      const { toSolidStartHandler } = await import("../../src/server");

      expect(() => {
        toSolidStartHandler({
          redirectUrl: "/dashboard",
        } as any);
      }).toThrow("toSolidStartHandler requires either a handler function or a providers config object");
    });

    it("should handle GET /oauth/callback (provider redirect)", async () => {
      const { toSolidStartHandler } = await import("../../src/server");

      const handlers = toSolidStartHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
        redirectUrl: "/dashboard",
      });

      const mockEvent = {
        request: {
          url: "http://localhost:3000/api/integrate/oauth/callback?code=test-code&state=test-state",
          method: "GET",
          headers: {
            get: () => null,
          },
        } as any,
      };

      const response = await handlers.GET(mockEvent);

      // Should redirect with OAuth callback in hash
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toContain("/dashboard");
      expect(location).toContain("oauth_callback");
    });

    it("should return all HTTP method handlers", async () => {
      const { toSolidStartHandler } = await import("../../src/server");

      const handlers = toSolidStartHandler({
        providers: {
          github: {
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
          },
        },
      });

      expect(handlers.GET).toBeDefined();
      expect(handlers.POST).toBeDefined();
      expect(handlers.PATCH).toBeDefined();
      expect(handlers.PUT).toBeDefined();
      expect(handlers.DELETE).toBeDefined();
    });
  });
});

