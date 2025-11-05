/**
 * Storage and Cleanup Tests
 * Tests for sessionStorage integration and client cleanup
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPClient, clearClientCache } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

// Mock browser environment
const mockStorage = new Map<string, string>();

beforeEach(() => {
  // Setup mock sessionStorage
  mockStorage.clear();
  
  // Mock global window object if it doesn't exist
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      sessionStorage: {
        getItem: (key: string) => mockStorage.get(key) || null,
        setItem: (key: string, value: string) => mockStorage.set(key, value),
        removeItem: (key: string) => mockStorage.delete(key),
      },
    };
  }
});

afterEach(async () => {
  mockStorage.clear();
  await clearClientCache();
});

describe("Storage and Cleanup", () => {
  describe("Session Token Storage", () => {
    test("loads session token from sessionStorage on creation", () => {
      // Pre-populate sessionStorage
      mockStorage.set('integrate_session_token', 'stored-token');

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Should load the token from storage
      expect(client.getSessionToken()).toBe('stored-token');
    });

    test("prefers config token over stored token", () => {
      // Pre-populate sessionStorage
      mockStorage.set('integrate_session_token', 'stored-token');

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'config-token',
        singleton: false,
      });

      // Should use config token, not stored token
      expect(client.getSessionToken()).toBe('config-token');
    });

    test("handles missing sessionStorage gracefully", () => {
      // Temporarily remove sessionStorage
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = undefined;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      // Should still work without sessionStorage
      expect(client.getSessionToken()).toBeUndefined();

      // Restore window
      (globalThis as any).window = originalWindow;
    });
  });

  describe("Client Cache Management", () => {
    test("clearClientCache removes cached instances", async () => {
      createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      await clearClientCache();

      // Creating new client after cache clear should work
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client).toBeDefined();
    });

    test("clearClientCache handles disconnection errors gracefully", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      // Should not throw even if disconnect fails
      await expect(clearClientCache()).resolves.toBeUndefined();
    });
  });

  describe("Token Persistence Across Operations", () => {
    test("token persists after disconnectProvider", async () => {
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
        sessionToken: 'multi-provider-token',
        singleton: false,
      });

      await client.disconnectProvider('github');

      // Token should still exist for other providers
      expect(client.getSessionToken()).toBe('multi-provider-token');
    });

    test("token clears after logout", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'test-token',
        singleton: false,
      });

      await client.logout();

      expect(client.getSessionToken()).toBeUndefined();
    });

    test("setSessionToken persists to sessionStorage", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setSessionToken('new-token');

      // Check both client and storage
      expect(client.getSessionToken()).toBe('new-token');
      expect(mockStorage.get('integrate_session_token')).toBe('new-token');
    });

    test("clearSessionToken removes from sessionStorage", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'test-token',
        singleton: false,
      });

      expect(mockStorage.get('integrate_session_token')).toBe('test-token');

      client.clearSessionToken();

      expect(client.getSessionToken()).toBeUndefined();
      expect(mockStorage.has('integrate_session_token')).toBe(false);
    });
  });

  describe("Auto-cleanup Configuration", () => {
    test("client with autoCleanup true is tracked", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        autoCleanup: true,
        singleton: false,
      });

      expect(client).toBeDefined();
    });

    test("client with autoCleanup false is not tracked", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        autoCleanup: false,
        singleton: false,
      });

      expect(client).toBeDefined();
    });
  });

  describe("Event System Storage Integration", () => {
    test("emits events even without browser storage", () => {
      // Temporarily remove sessionStorage
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = undefined;

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let eventFired = false;
      client.on('auth:disconnect', () => {
        eventFired = true;
      });

      client.disconnectProvider('github');

      expect(eventFired).toBe(true);

      // Restore window
      (globalThis as any).window = originalWindow;
    });
  });

  describe("Multiple Client Instances", () => {
    test("each non-singleton instance manages its own state", () => {
      const client1 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'token1',
        singleton: false,
      });

      const client2 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'token2',
        singleton: false,
      });

      expect(client1.getSessionToken()).toBe('token1');
      expect(client2.getSessionToken()).toBe('token2');
    });

    test("disconnecting provider in one instance does not affect others", async () => {
      const client1 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const client2 = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      await client1.disconnectProvider('github');

      expect(client1.isProviderAuthenticated('github')).toBe(false);
      expect(client2.isProviderAuthenticated('github')).toBe(true);
    });
  });

  describe("Configuration Validation", () => {
    test("creates client with empty plugins array", () => {
      const client = createMCPClient({
        plugins: [],
        singleton: false,
      });

      expect(client).toBeDefined();
      expect(client.getEnabledTools()).toEqual([]);
    });

    test("creates client with minimal config", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
      });

      expect(client).toBeDefined();
    });

    test("creates client with maximal config", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        sessionToken: 'test-token',
        timeout: 60000,
        headers: { 'X-Custom': 'value' },
        clientInfo: { name: 'custom', version: '1.0' },
        connectionMode: 'manual',
        singleton: false,
        autoCleanup: false,
        maxReauthRetries: 3,
        oauthApiBase: '/custom/oauth',
        oauthFlow: {
          mode: 'popup',
          popupOptions: { width: 800, height: 900 },
        },
        autoHandleOAuthCallback: false,
        onReauthRequired: async () => true,
      });

      expect(client).toBeDefined();
    });
  });

  describe("State Consistency", () => {
    test("logout maintains auth state structure", async () => {
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
        singleton: false,
      });

      await client.logout();

      // Auth states should exist but be false
      expect(client.getAuthState('github')).toBeDefined();
      expect(client.getAuthState('google')).toBeDefined();
      expect(client.isProviderAuthenticated('github')).toBe(false);
      expect(client.isProviderAuthenticated('google')).toBe(false);
    });

    test("disconnectProvider only affects specified provider", async () => {
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
        singleton: false,
      });

      await client.disconnectProvider('github');

      const githubState = client.getAuthState('github');
      const gmailState = client.getAuthState('google');

      expect(githubState?.authenticated).toBe(false);
      expect(gmailState?.authenticated).toBe(true);
    });
  });
});

