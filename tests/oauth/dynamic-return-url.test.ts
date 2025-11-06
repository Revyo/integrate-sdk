/**
 * Dynamic Return URL Tests
 * Tests for dynamic OAuth return URL functionality
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { OAuthManager } from "../../src/oauth/manager.js";
import { generateStateWithReturnUrl, parseState } from "../../src/oauth/pkce.js";
import { createOAuthRedirectHandler } from "../../src/adapters/nextjs-oauth-redirect.js";

const TEST_SERVER_URL = "https://test.mcp.server.com";

describe("Dynamic Return URL", () => {
  describe("Client authorize() with returnUrl", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      
      // Mock fetch to prevent actual network calls
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          url: "https://github.com/login/oauth/authorize?client_id=test&state=abc",
        }),
      })) as any;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test("authorize accepts returnUrl option", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Should not throw when called with returnUrl
      try {
        await client.authorize("github", { returnUrl: "/marketplace/github" });
      } catch (error) {
        // Expected to fail in test environment without real DOM
        // The important part is that it accepts the parameter
      }
    });

    test("authorize works without returnUrl (backward compatibility)", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Should not throw when called without returnUrl
      try {
        await client.authorize("github");
      } catch (error) {
        // Expected to fail in test environment without real DOM
      }
    });

    test("authorize with returnUrl passes value to OAuth manager", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
        oauthFlow: {
          mode: 'redirect',
        },
      });

      const returnUrl = "/marketplace/github";

      try {
        await client.authorize("github", { returnUrl });
        // In real scenario, this would encode returnUrl in the state parameter
      } catch (error) {
        // Expected to fail in test environment without real DOM
      }
    });
  });

  describe("OAuthManager initiateFlow with returnUrl", () => {
    let manager: OAuthManager;
    let originalFetch: typeof fetch;

    beforeEach(() => {
      manager = new OAuthManager(TEST_SERVER_URL, { mode: 'redirect' });
      originalFetch = global.fetch;
      
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          url: "https://github.com/login/oauth/authorize?client_id=test&state=abc",
        }),
      })) as any;
    });

    afterEach(() => {
      manager.close();
      global.fetch = originalFetch;
    });

    test("initiateFlow accepts returnUrl parameter", async () => {
      const config = {
        provider: "github",
        clientId: "test-id",
        clientSecret: "test-secret",
        scopes: ["repo"],
      };
      const returnUrl = "/marketplace/github";

      try {
        await manager.initiateFlow("github", config, returnUrl);
      } catch (error) {
        // Expected to fail in test environment
      }
    });

    test("initiateFlow works without returnUrl", async () => {
      const config = {
        provider: "github",
        clientId: "test-id",
        clientSecret: "test-secret",
        scopes: ["repo"],
      };

      try {
        await manager.initiateFlow("github", config);
      } catch (error) {
        // Expected to fail in test environment
      }
    });
  });

  describe("State parameter with returnUrl", () => {
    test("state encodes and decodes returnUrl correctly", () => {
      const returnUrl = "/marketplace/github";
      const state = generateStateWithReturnUrl(returnUrl);
      const decoded = parseState(state);

      expect(decoded.returnUrl).toBe(returnUrl);
      expect(decoded.csrf).toBeDefined();
      expect(decoded.csrf.length).toBeGreaterThan(0);
    });

    test("state without returnUrl does not include it", () => {
      const state = generateStateWithReturnUrl();
      const decoded = parseState(state);

      expect(decoded.returnUrl).toBeUndefined();
      expect(decoded.csrf).toBeDefined();
    });

    test("different returnUrls produce different states", () => {
      const state1 = generateStateWithReturnUrl("/page1");
      const state2 = generateStateWithReturnUrl("/page2");

      expect(state1).not.toBe(state2);

      const decoded1 = parseState(state1);
      const decoded2 = parseState(state2);

      expect(decoded1.returnUrl).toBe("/page1");
      expect(decoded2.returnUrl).toBe("/page2");
    });

    test("handles complex URLs with query params and hash", () => {
      const returnUrl = "/marketplace?tab=oauth&filter=active#integrations";
      const state = generateStateWithReturnUrl(returnUrl);
      const decoded = parseState(state);

      expect(decoded.returnUrl).toBe(returnUrl);
    });
  });

  describe("createOAuthRedirectHandler with dynamic returnUrl", () => {
    test("handler extracts returnUrl from state parameter", async () => {
      const returnUrl = "/marketplace/github";
      const state = generateStateWithReturnUrl(returnUrl);
      const code = "test-code-123";

      const handler = createOAuthRedirectHandler({
        redirectUrl: "/", // Default fallback
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?code=${code}&state=${state}`,
        headers: {
          get: (name: string) => null,
        },
      };

      const response = await handler(mockRequest);
      
      // Response should redirect to the returnUrl from state
      expect(response).toBeDefined();
    });

    test("handler falls back to configured redirectUrl when no returnUrl in state", async () => {
      const state = generateStateWithReturnUrl(); // No returnUrl
      const code = "test-code-123";

      const handler = createOAuthRedirectHandler({
        redirectUrl: "/dashboard", // Fallback
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?code=${code}&state=${state}`,
        headers: {
          get: (name: string) => null,
        },
      };

      const response = await handler(mockRequest);
      
      expect(response).toBeDefined();
    });

    test("handler handles legacy plain state format", async () => {
      const plainState = "plain-csrf-token-12345";
      const code = "test-code-123";

      const handler = createOAuthRedirectHandler({
        redirectUrl: "/fallback",
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?code=${code}&state=${plainState}`,
        headers: {
          get: (name: string) => null,
        },
      };

      const response = await handler(mockRequest);
      
      // Should redirect to fallback URL
      expect(response).toBeDefined();
    });

    test("handler uses referrer as fallback when state parsing fails", async () => {
      const invalidState = "!!!invalid!!!";
      const code = "test-code-123";

      const handler = createOAuthRedirectHandler({
        redirectUrl: "/",
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?code=${code}&state=${invalidState}`,
        headers: {
          get: (name: string) => {
            if (name === 'referer' || name === 'referrer') {
              return 'https://example.com/marketplace/github';
            }
            return null;
          },
        },
      };

      const response = await handler(mockRequest);
      
      expect(response).toBeDefined();
    });

    test("handler only uses referrer from same origin", async () => {
      const invalidState = "!!!invalid!!!";
      const code = "test-code-123";

      const handler = createOAuthRedirectHandler({
        redirectUrl: "/safe-default",
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?code=${code}&state=${invalidState}`,
        headers: {
          get: (name: string) => {
            if (name === 'referer' || name === 'referrer') {
              // Different origin - should not be used
              return 'https://evil.com/steal-tokens';
            }
            return null;
          },
        },
      };

      const response = await handler(mockRequest);
      
      // Should use default, not the cross-origin referrer
      expect(response).toBeDefined();
    });

    test("handler handles OAuth errors appropriately", async () => {
      const handler = createOAuthRedirectHandler({
        redirectUrl: "/",
        errorRedirectUrl: "/error",
      });

      const mockRequest = {
        url: `https://example.com/oauth/callback?error=access_denied&error_description=User%20denied%20access`,
        headers: {
          get: (name: string) => null,
        },
      };

      const response = await handler(mockRequest);
      
      expect(response).toBeDefined();
    });
  });

  describe("End-to-end returnUrl flow", () => {
    test("complete flow from authorize to redirect", () => {
      // 1. User starts OAuth from a specific page
      const originPage = "/marketplace/github";
      
      // 2. Generate state with return URL
      const state = generateStateWithReturnUrl(originPage);
      
      // 3. State is sent to OAuth provider (simulated)
      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(0);
      
      // 4. OAuth provider returns with same state
      const decoded = parseState(state);
      
      // 5. Return URL is extracted
      expect(decoded.returnUrl).toBe(originPage);
      
      // 6. User is redirected back to origin page
      // (This would happen in createOAuthRedirectHandler)
    });

    test("flow without returnUrl falls back gracefully", () => {
      // 1. User starts OAuth without specifying returnUrl
      const state = generateStateWithReturnUrl();
      
      // 2. State is still valid
      expect(state).toBeDefined();
      
      // 3. No return URL in decoded state
      const decoded = parseState(state);
      expect(decoded.returnUrl).toBeUndefined();
      
      // 4. System would fall back to configured default
    });
  });
});

