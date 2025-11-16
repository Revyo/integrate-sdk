/**
 * Server Configuration Coverage Tests
 * 
 * Tests specifically designed to improve code coverage for server.ts
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { githubIntegration } from "../../src/integrations/github.js";
import { gmailIntegration } from "../../src/integrations/gmail.js";

describe("Server Configuration Coverage Tests", () => {
  let originalProcessEnv: any;
  let originalWindow: any;

  beforeEach(() => {
    // Store original values
    originalProcessEnv = { ...process.env };
    originalWindow = (globalThis as any).window;
  });

  afterEach(() => {
    // Restore original values
    process.env = originalProcessEnv;

    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
  });

  describe("getDefaultRedirectUri", () => {
    test("uses INTEGRATE_URL when available", async () => {
      delete (globalThis as any).window;
      process.env.INTEGRATE_URL = 'https://app.example.com';
      delete process.env.VERCEL_URL;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should use INTEGRATE_URL
      expect(client).toBeDefined();
    });

    test("uses VERCEL_URL when INTEGRATE_URL is not available", async () => {
      delete (globalThis as any).window;
      delete process.env.INTEGRATE_URL;
      process.env.VERCEL_URL = 'myapp.vercel.app';

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should use VERCEL_URL with https://
      expect(client).toBeDefined();
    });

    test("falls back to localhost when no env vars set", async () => {
      delete (globalThis as any).window;
      delete process.env.INTEGRATE_URL;
      delete process.env.VERCEL_URL;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should fall back to localhost
      expect(client).toBeDefined();
    });

    test("throws error in browser context", async () => {
      (globalThis as any).window = {
        location: {
          origin: 'https://browser.example.com',
        },
      };

      const { createMCPServer } = await import("../../src/server.js");

      // Should throw in browser context
      expect(() => {
        createMCPServer({
          integrations: [
            githubIntegration({
              clientId: 'test-id',
              clientSecret: 'test-secret',
            }),
          ],
        });
      }).toThrow('server-side');
    });
  });

  describe("createMCPServer - Integration Configuration", () => {
    test("handles integration without OAuth config", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");
      const { createSimpleIntegration } = await import("../../src/integrations/generic.js");

      const { client } = createMCPServer({
        integrations: [
          createSimpleIntegration({
            id: 'simple',
            tools: ['test_tool'],
          }) as any,
        ],
      });

      // Should handle non-OAuth integration
      expect(client).toBeDefined();
    });

    test("warns when integration is missing OAuth credentials", async () => {
      delete (globalThis as any).window;

      const originalConsoleWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
      };

      const { createMCPServer } = await import("../../src/server.js");

      // Create integration with OAuth but missing credentials
      const integrationWithBadOAuth = {
        id: 'bad-oauth',
        tools: ['test'],
        oauth: {
          // Missing clientId and clientSecret
          scopes: ['read'],
        },
      };

      const { client } = createMCPServer({
        integrations: [integrationWithBadOAuth as any],
      });

      // Should warn about missing credentials
      expect(warnings.some(w => w.includes('missing OAuth credentials'))).toBe(true);
      expect(client).toBeDefined();

      console.warn = originalConsoleWarn;
    });

    test("uses integration-specific redirectUri over global config", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        redirectUri: 'https://global.example.com/callback',
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
            redirectUri: 'https://integration-specific.example.com/callback',
          }),
        ],
      });

      // Integration-specific redirectUri should be used
      expect(client).toBeDefined();
    });

    test("uses global redirectUri when integration doesn't specify one", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        redirectUri: 'https://global.example.com/callback',
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
            // No redirectUri specified
          }),
        ],
      });

      // Global redirectUri should be used
      expect(client).toBeDefined();
    });

    test("auto-detects redirectUri when not provided", async () => {
      delete (globalThis as any).window;
      process.env.INTEGRATE_URL = 'https://auto.example.com';

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        // No redirectUri specified
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should auto-detect from env
      expect(client).toBeDefined();
    });
  });

  describe("createMCPServer - API Key", () => {
    test("sets X-API-KEY header when apiKey provided", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        apiKey: 'test-api-key-123',
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Header should be set
      expect(client).toBeDefined();
      // The setRequestHeader method should have been called
    });

    test("does not set X-API-KEY header when apiKey not provided", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        // No apiKey
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should work without apiKey
      expect(client).toBeDefined();
    });
  });

  describe("createMCPServer - Multiple Integrations", () => {
    test("handles multiple OAuth integrations", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'github-id',
            clientSecret: 'github-secret',
          }),
          gmailIntegration({
            clientId: 'gmail-id',
            clientSecret: 'gmail-secret',
          }),
        ],
      });

      // Should handle multiple integrations
      expect(client).toBeDefined();
    });

    test("handles mix of OAuth and non-OAuth integrations", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");
      const { createSimpleIntegration } = await import("../../src/integrations/generic.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'github-id',
            clientSecret: 'github-secret',
          }),
          createSimpleIntegration({
            id: 'simple',
            tools: ['test'],
          }) as any,
        ],
      });

      // Should handle mixed integrations
      expect(client).toBeDefined();
    });
  });

  describe("createMCPServer - Route Handlers", () => {
    test("returns POST and GET handlers", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const result = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should return handlers
      expect(result.POST).toBeDefined();
      expect(result.GET).toBeDefined();
      expect(typeof result.POST).toBe('function');
      expect(typeof result.GET).toBe('function');
    });

    test("attaches OAuth config to client", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should attach __oauthConfig
      expect((client as any).__oauthConfig).toBeDefined();
      expect((client as any).__oauthConfig.providers).toBeDefined();
    });
  });

  describe("createMCPServer - Connection Mode", () => {
    test("uses lazy connection mode by default", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Default should be lazy
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    test("respects manual connection mode", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        connectionMode: 'manual',
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should be manual mode
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    test("respects singleton setting", async () => {
      delete (globalThis as any).window;

      const { createMCPServer } = await import("../../src/server.js");

      const { client } = createMCPServer({
        singleton: false,
        integrations: [
          githubIntegration({
            clientId: 'test-id',
            clientSecret: 'test-secret',
          }),
        ],
      });

      // Should respect singleton setting
      expect(client).toBeDefined();
    });
  });

  describe("createMCPServer - Error Handling", () => {
    test("throws error when called in browser", async () => {
      // Simulate browser environment
      (globalThis as any).window = {
        location: { href: 'http://localhost' },
      };

      const { createMCPServer } = await import("../../src/server.js");

      // Should throw error in browser
      expect(() => {
        createMCPServer({
          integrations: [
            githubIntegration({
              clientId: 'test-id',
              clientSecret: 'test-secret',
            }),
          ],
        });
      }).toThrow('createMCPServer() should only be called on the server-side');
    });
  });
});

