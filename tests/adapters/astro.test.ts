/**
 * Astro Adapter Tests
 * Tests the Astro OAuth handler with mock request objects
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { toAstroHandler } from '../../src/adapters/astro';

// Mock Astro context
function createMockContext(options: {
  method?: string;
  url?: string;
  body?: any;
  headers?: Headers;
}) {
  const url = options.url || 'http://localhost:3000/api/auth/authorize';
  const headers = options.headers || new Headers();
  
  const request = new Request(url, {
    method: options.method || 'POST',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return { request };
}

describe('Astro Adapter', () => {
  const mockConfig = {
    providers: {
      github: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
      },
    },
    serverUrl: 'http://mock-server.test',
  };

  let handler: ReturnType<typeof toAstroHandler>;

  beforeEach(() => {
    handler = toAstroHandler(mockConfig);
  });

  describe('authorize', () => {
    test('should handle authorize POST request', async () => {
      const context = createMockContext({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/authorize',
        body: {
          provider: 'github',
          scopes: ['repo', 'user'],
          state: 'test-state',
          codeChallenge: 'test-challenge',
          codeChallengeMethod: 'S256',
        },
      });

      const response = await handler(context);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toContain('json');
    });
  });

  describe('callback', () => {
    test('should handle callback POST request', async () => {
      const context = createMockContext({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/callback',
        body: {
          provider: 'github',
          code: 'auth-code',
          codeVerifier: 'verifier',
          state: 'test-state',
        },
      });

      const response = await handler(context);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toContain('json');
    });
  });

  describe('status', () => {
    test('should require provider query parameter', async () => {
      const context = createMockContext({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/status',
        headers: new Headers({
          'authorization': 'Bearer test-token',
        }),
      });

      const response = await handler(context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('provider');
    });

    test('should require authorization header', async () => {
      const context = createMockContext({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/status?provider=github',
      });

      const response = await handler(context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Authorization');
    });

    test('should handle valid status request', async () => {
      const context = createMockContext({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/status?provider=github',
        headers: new Headers({
          'authorization': 'Bearer test-token',
        }),
      });

      const response = await handler(context);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toContain('json');
    });
  });

  describe('disconnect', () => {
    test('should require authorization header', async () => {
      const context = createMockContext({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/disconnect',
        body: { provider: 'github' },
      });

      const response = await handler(context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Authorization');
    });

    test('should require provider in body', async () => {
      const context = createMockContext({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/disconnect',
        body: {},
        headers: new Headers({
          'authorization': 'Bearer test-token',
        }),
      });

      const response = await handler(context);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('provider');
    });

    test('should handle valid disconnect request', async () => {
      const context = createMockContext({
        method: 'POST',
        url: 'http://localhost:3000/api/auth/disconnect',
        body: { provider: 'github' },
        headers: new Headers({
          'authorization': 'Bearer test-token',
        }),
      });

      const response = await handler(context);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toContain('json');
    });
  });

  describe('unknown action', () => {
    test('should return 404 for unknown action', async () => {
      const context = createMockContext({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/unknown',
      });

      const response = await handler(context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('Unknown action');
    });
  });
});

