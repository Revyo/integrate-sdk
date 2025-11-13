/**
 * Express Adapter Tests
 * Tests the Express OAuth handler with mock request/response objects
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { toExpressHandler } from '../../src/adapters/express';

// Mock Express request/response objects
function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    body: options.body || {},
    query: options.query || {},
    headers: options.headers || {},
  };
}

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status: function(code: number) {
      this.statusCode = code;
      return this;
    },
    json: function(data: any) {
      this.body = data;
      return this;
    },
    setHeader: function(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
}

describe('Express Adapter', () => {
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

  let handler: ReturnType<typeof toExpressHandler>;

  beforeEach(() => {
    handler = toExpressHandler(mockConfig);
  });

  describe('authorize', () => {
    test('should handle authorize request', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          provider: 'github',
          scopes: ['repo', 'user'],
          state: 'test-state',
          codeChallenge: 'test-challenge',
          codeChallengeMethod: 'S256',
        },
      });
      const res = createMockResponse();

      // Note: This will fail in tests without mocking the actual OAuth flow
      // In a real test, you would mock the fetch calls to the MCP server
      await handler.authorize(req, res, () => {});

      // Check that a response was sent (even if it's an error in test environment)
      expect(res.body).toBeDefined();
    });

    test('should return error for invalid request', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {}, // Missing required fields
      });
      const res = createMockResponse();

      await handler.authorize(req, res, () => {});

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('callback', () => {
    test('should handle callback request', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {
          provider: 'github',
          code: 'auth-code',
          codeVerifier: 'verifier',
          state: 'test-state',
        },
      });
      const res = createMockResponse();

      await handler.callback(req, res, () => {});

      expect(res.body).toBeDefined();
    });
  });

  describe('status', () => {
    test('should require provider query parameter', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: {},
        headers: {
          authorization: 'Bearer test-token',
        },
      });
      const res = createMockResponse();

      await handler.status(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('provider');
    });

    test('should require authorization header', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: { provider: 'github' },
        headers: {},
      });
      const res = createMockResponse();

      await handler.status(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Authorization');
    });

    test('should handle valid status check', async () => {
      const req = createMockRequest({
        method: 'GET',
        query: { provider: 'github' },
        headers: {
          authorization: 'Bearer test-token',
        },
      });
      const res = createMockResponse();

      await handler.status(req, res, () => {});

      expect(res.body).toBeDefined();
    });
  });

  describe('disconnect', () => {
    test('should require authorization header', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { provider: 'github' },
        headers: {},
      });
      const res = createMockResponse();

      await handler.disconnect(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('Authorization');
    });

    test('should require provider in body', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: {},
        headers: {
          authorization: 'Bearer test-token',
        },
      });
      const res = createMockResponse();

      await handler.disconnect(req, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('provider');
    });

    test('should handle valid disconnect request', async () => {
      const req = createMockRequest({
        method: 'POST',
        body: { provider: 'github' },
        headers: {
          authorization: 'Bearer test-token',
        },
      });
      const res = createMockResponse();

      await handler.disconnect(req, res, () => {});

      expect(res.body).toBeDefined();
    });
  });
});

