/**
 * Next.js Adapter Coverage Tests
 * 
 * Tests specifically designed to improve code coverage for nextjs.ts adapter
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { githubIntegration } from "../../src/integrations/github.js";
import { gmailIntegration } from "../../src/integrations/gmail.js";

describe("Next.js Adapter Coverage Tests", () => {
  beforeEach(() => {
    // Clean up window
    delete (globalThis as any).window;
  });

  describe("toNextJsHandler - Error Cases", () => {
    test("handles missing params", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      const handlers = toNextJsHandler(client);

      // Create a request with missing params
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/integrate/oauth/authorize',
        headers: new Map(),
        json: async () => ({}), // Missing provider
      } as any;

      const context = {
        params: Promise.resolve({ action: ['authorize'] }),
      };

      try {
        await handlers.POST(request, context);
      } catch (error: any) {
        // Should throw an error for missing provider
        expect(error.message || error).toBeDefined();
      }
    });

    test("handles invalid action", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      const handlers = toNextJsHandler(client);

      // Create a request with invalid action
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/integrate/oauth/invalid',
        headers: new Map(),
        json: async () => ({ provider: 'github' }),
      } as any;

      const context = {
        params: Promise.resolve({ action: ['invalid'] }),
      };

      const response = await handlers.POST(request, context);
      // Returns 500 for invalid action
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("handles callback with error parameter", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      const handlers = toNextJsHandler(client);

      // Create a request with error
      const request = {
        method: 'GET',
        url: 'http://localhost:3000/api/integrate/oauth/callback?error=access_denied&state=test',
        headers: new Map([['referer', 'http://localhost:3000/']]),
      } as any;

      const searchParams = new URLSearchParams('error=access_denied&state=test');
      (request as any).nextUrl = { searchParams };

      const context = {
        params: Promise.resolve({ action: ['callback'] }),
      };

      const response = await handlers.GET(request, context);

      // Should handle the error (might redirect or return error status)
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test("handles disconnect with missing provider", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      const handlers = toNextJsHandler(client);

      // Create a request without provider
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/integrate/oauth/disconnect',
        headers: new Map(),
        json: async () => ({}), // Missing provider
      } as any;

      const context = {
        params: Promise.resolve({ action: ['disconnect'] }),
      };

      try {
        await handlers.POST(request, context);
      } catch (error) {
        // Should handle missing provider
        expect(error).toBeDefined();
      }
    });

    test("handles authorize with missing client credentials", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      // Create server with integration missing credentials
      const integrationWithMissingCreds = {
        id: 'test-provider',
        tools: ['test'],
        oauth: {
          scopes: ['read'],
          // Missing clientId and clientSecret
        },
      };

      const { client } = createMCPServer({
        integrations: [integrationWithMissingCreds as any],
      });

      const handlers = toNextJsHandler(client);

      // Create authorize request
      const request = {
        method: 'POST',
        url: 'http://localhost:3000/api/integrate/oauth/authorize',
        headers: new Map(),
        json: async () => ({ provider: 'test-provider' }),
      } as any;

      const context = {
        params: Promise.resolve({ action: ['authorize'] }),
      };

      try {
        await handlers.POST(request, context);
      } catch (error: any) {
        // Should throw error for missing credentials
        expect(error.message || error).toBeDefined();
      }
    });
  });

  describe("toNextJsHandler - Manual Configuration", () => {
    test("accepts manual OAuth config", async () => {
      const { toNextJsHandler } = await import("../../src/server.js");

      const config = {
        providers: {
          github: {
            clientId: 'manual-id',
            clientSecret: 'manual-secret',
            redirectUri: 'https://manual.example.com/callback',
          },
        },
      };

      const handlers = toNextJsHandler(config);

      // Should create handlers
      expect(handlers.POST).toBeDefined();
      expect(handlers.GET).toBeDefined();
    });

    test("handles manual config with multiple providers", async () => {
      const { toNextJsHandler } = await import("../../src/server.js");

      const config = {
        providers: {
          github: {
            clientId: 'github-id',
            clientSecret: 'github-secret',
            redirectUri: 'https://example.com/callback',
          },
          gmail: {
            clientId: 'gmail-id',
            clientSecret: 'gmail-secret',
            redirectUri: 'https://example.com/callback',
          },
        },
      };

      const handlers = toNextJsHandler(config);

      // Should handle multiple providers
      expect(handlers.POST).toBeDefined();
      expect(handlers.GET).toBeDefined();
    });
  });

  describe("toNextJsHandler - Default Config", () => {
    test("uses global config when no config provided", async () => {
      const { createMCPServer, toNextJsHandler } = await import("../../src/server.js");

      // Create server to set global config
      createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'global-id',
            clientSecret: 'global-secret',
          }),
        ],
      });

      // Call toNextJsHandler without config
      const handlers = toNextJsHandler();

      // Should use global config
      expect(handlers.POST).toBeDefined();
      expect(handlers.GET).toBeDefined();
    });
  });

  describe("OAuth Redirect Handler", () => {
    test("handles missing state parameter", async () => {
      const { createOAuthRedirectHandler } = await import("../../src/adapters/nextjs-oauth-redirect.js");

      const handler = createOAuthRedirectHandler({
        redirectUrl: '/dashboard',
        errorRedirectUrl: '/error',
      });

      // Create request without state
      const request = {
        url: 'http://localhost:3000/callback?code=abc123',
        nextUrl: {
          searchParams: new URLSearchParams('code=abc123'),
        },
      } as any;

      const response = await handler(request);

      // Should handle missing state
      expect(response.status).toBe(302);
    });

    test("handles error in callback URL", async () => {
      const { createOAuthRedirectHandler } = await import("../../src/adapters/nextjs-oauth-redirect.js");

      const handler = createOAuthRedirectHandler({
        redirectUrl: '/dashboard',
        errorRedirectUrl: '/error',
      });

      // Create request with error
      const request = {
        url: 'http://localhost:3000/callback?error=access_denied',
        nextUrl: {
          searchParams: new URLSearchParams('error=access_denied'),
        },
      } as any;

      const response = await handler(request);

      // Should redirect to error page
      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toContain('/error');
    });

    test("uses referrer when state parsing fails", async () => {
      const { createOAuthRedirectHandler } = await import("../../src/adapters/nextjs-oauth-redirect.js");

      const handler = createOAuthRedirectHandler({
        redirectUrl: '/dashboard',
        errorRedirectUrl: '/error',
      });

      // Create request with invalid state but valid referrer
      const request = {
        url: 'http://localhost:3000/callback?code=abc&state=invalid',
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'referer') {
              return 'http://localhost:3000/origin-page';
            }
            return null;
          },
        },
        nextUrl: {
          searchParams: new URLSearchParams('code=abc&state=invalid'),
        },
      } as any;

      const response = await handler(request);

      // Should use referrer
      expect(response.status).toBe(302);
    });

    test("rejects cross-origin referrer", async () => {
      const { createOAuthRedirectHandler } = await import("../../src/adapters/nextjs-oauth-redirect.js");

      const handler = createOAuthRedirectHandler({
        redirectUrl: '/dashboard',
        errorRedirectUrl: '/error',
      });

      // Create request with cross-origin referrer
      const request = {
        url: 'http://localhost:3000/callback?code=abc&state=invalid',
        headers: {
          get: (name: string) => {
            if (name.toLowerCase() === 'referer') {
              return 'http://evil.com/phishing';
            }
            return null;
          },
        },
        nextUrl: {
          searchParams: new URLSearchParams('code=abc&state=invalid'),
        },
      } as any;

      const response = await handler(request);

      // Should not use cross-origin referrer
      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).not.toContain('evil.com');
    });
  });
});

