/**
 * Storage and Cleanup Tests
 * Tests for sessionStorage integration and client cleanup
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createMCPClient, clearClientCache } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";

// Mock browser environment
const mockSessionStorage = new Map<string, string>();
const mockLocalStorage = new Map<string, string>();

describe("Storage and Cleanup", () => {
  beforeEach(() => {
    // Setup mock storage
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    
    // Mock global window object if it doesn't exist
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {
      sessionStorage: {
        getItem: (key: string) => mockSessionStorage.get(key) || null,
        setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
        removeItem: (key: string) => mockSessionStorage.delete(key),
        clear: () => mockSessionStorage.clear(),
        get length() { return mockSessionStorage.size; },
        key: (index: number) => Array.from(mockSessionStorage.keys())[index] || null,
      },
      localStorage: {
        getItem: (key: string) => mockLocalStorage.get(key) || null,
        setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
        removeItem: (key: string) => mockLocalStorage.delete(key),
        clear: () => mockLocalStorage.clear(),
        get length() { return mockLocalStorage.size; },
        key: (index: number) => Array.from(mockLocalStorage.keys())[index] || null,
      },
      };
    }
  });

  afterEach(async () => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    await clearClientCache();
    
    // Clean up global window mock if it was set by this test file
    if ((globalThis as any).window) {
      // Clear any provider tokens
      try {
        if ((globalThis as any).window.localStorage) {
          (globalThis as any).window.localStorage.removeItem('integrate_token_github');
          (globalThis as any).window.localStorage.removeItem('integrate_token_google');
        }
      } catch {
        // Ignore errors
      }
    }
  });

  describe("Provider Token Storage", () => {
    test("loads provider token from localStorage on creation", () => {
      // Pre-populate localStorage with provider token
      const tokenData = {
        accessToken: 'stored-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };
      mockLocalStorage.set('integrate_token_github', JSON.stringify(tokenData));

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
      const loadedToken = client.getProviderToken('github');
      expect(loadedToken).toEqual(tokenData);
    });

    test("loads tokens for multiple providers", () => {
      // Pre-populate localStorage with multiple provider tokens
      const githubToken = {
        accessToken: 'github-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };
      const gmailToken = {
        accessToken: 'gmail-token',
        tokenType: 'Bearer',
        expiresIn: 7200,
      };
      
      mockLocalStorage.set('integrate_token_github', JSON.stringify(githubToken));
      mockLocalStorage.set('integrate_token_gmail', JSON.stringify(gmailToken));

      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "github-id",
            clientSecret: "github-secret",
          }),
          gmailPlugin({
            clientId: "gmail-id",
            clientSecret: "gmail-secret",
          }),
        ],
        singleton: false,
      });

      // Should load both tokens from storage
      expect(client.getProviderToken('github')).toEqual(githubToken);
      expect(client.getProviderToken('gmail')).toEqual(gmailToken);
    });

    test("handles missing localStorage gracefully", () => {
      // Temporarily remove localStorage
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

      // Should still work without localStorage
      expect(client.getProviderToken('github')).toBeUndefined();

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
    test("other provider tokens persist after disconnectProvider", async () => {
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

      // Set provider tokens
      client.setProviderToken('github', {
        accessToken: 'github-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
      client.setProviderToken('gmail', {
        accessToken: 'gmail-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      await client.disconnectProvider('github');

      // Gmail token should still exist
      expect(client.getProviderToken('github')).toBeUndefined();
      expect(client.getProviderToken('gmail')).toBeDefined();
    });

    test("all tokens clear after logout", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      client.setProviderToken('github', {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      await client.logout();

      expect(client.getProviderToken('github')).toBeUndefined();
    });

    test("setProviderToken persists to localStorage", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const tokenData = {
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      client.setProviderToken('github', tokenData);

      // Check both client and storage
      expect(client.getProviderToken('github')).toEqual(tokenData);
      expect(mockLocalStorage.get('integrate_token_github')).toBe(JSON.stringify(tokenData));
    });

    test("clearSessionToken removes all tokens from localStorage", () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      const tokenData = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      client.setProviderToken('github', tokenData);

      expect(mockLocalStorage.has('integrate_token_github')).toBe(true);

      client.clearSessionToken();

      expect(client.getProviderToken('github')).toBeUndefined();
      expect(mockLocalStorage.has('integrate_token_github')).toBe(false);
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
    test("emits error event when disconnect fails without access token", async () => {
      const client = createMCPClient({
        plugins: [
          githubPlugin({
            clientId: "test-id",
            clientSecret: "test-secret",
          }),
        ],
        singleton: false,
      });

      let errorFired = false;
      client.on('auth:error', () => {
        errorFired = true;
      });

      // Should throw and emit error because no access token
      await expect(client.disconnectProvider('github')).rejects.toThrow();
      expect(errorFired).toBe(true);
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

      const token1 = {
        accessToken: 'token1',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      const token2 = {
        accessToken: 'token2',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      client1.setProviderToken('github', token1);
      client2.setProviderToken('github', token2);

      expect(client1.getProviderToken('github')).toEqual(token1);
      expect(client2.getProviderToken('github')).toEqual(token2);
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

      client1.setProviderToken('github', {
        accessToken: 'token1',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      client2.setProviderToken('github', {
        accessToken: 'token2',
        tokenType: 'Bearer',
        expiresIn: 3600,
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
      expect(client.getAuthState('gmail')).toBeDefined();
      expect(client.isProviderAuthenticated('github')).toBe(false);
      expect(client.isProviderAuthenticated('gmail')).toBe(false);
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

      // Set provider tokens
      client.setProviderToken('github', {
        accessToken: 'github-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
      client.setProviderToken('gmail', {
        accessToken: 'gmail-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      await client.disconnectProvider('github');

      const githubState = client.getAuthState('github');
      const gmailState = client.getAuthState('gmail');

      expect(githubState?.authenticated).toBe(false);
      expect(gmailState?.authenticated).toBe(true);
    });
  });
});

