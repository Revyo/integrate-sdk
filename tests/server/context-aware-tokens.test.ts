/**
 * Tests for Context-Aware Token Storage
 * Verifies that user context is properly passed through to getProviderToken and setProviderToken callbacks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClientBase } from '../../src/client.js';
import type { MCPClientConfig, MCPContext, ProviderTokenData } from '../../src/config/types.js';
import type { MCPIntegration } from '../../src/integrations/types.js';

describe('Context-Aware Token Storage', () => {
  const mockIntegration: MCPIntegration = {
    id: 'github',
    name: 'GitHub',
    oauth: {
      provider: 'github',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scopes: ['repo'],
    },
    tools: ['github_list_repos'],
  };

  const mockTokenData: ProviderTokenData = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch globally for all tests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Success' }] }),
    } as Response);
  });

  describe('Direct Integration Method Calls', () => {
    it('should pass context to getProviderToken callback when calling integration method', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);
      const setProviderToken = vi.fn().mockResolvedValue(undefined);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
        setProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      // Call an integration method with context
      await (client as any).github.listRepos({}, { context });

      // Verify getProviderToken was called with the context
      // Note: It's called twice - once during client init (without context) and once for the method call (with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined); // Initial check during construction
      expect(getProviderToken).toHaveBeenCalledWith('github', context); // Method call with context
    });

    it('should work without context (backward compatibility)', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Mock at callToolThroughHandler level
      vi.spyOn(client as any, 'callToolThroughHandler').mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      // Call integration method without context
      await (client as any).github.listRepos({});

      // Verify getProviderToken was called without context (twice - init + method call)
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined);
    });

    it('should pass context with multiple fields', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
        sessionId: 'session789',
        tenantId: 'tenant999',
        customField: 'custom-value',
      };

      // Call integration method with rich context
      await (client as any).github.listRepos({}, { context });

      // Verify all context fields were passed
      // Note: It's called twice - once during client init (without context) and once for the method call (with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined); // Initial check during construction
      expect(getProviderToken).toHaveBeenCalledWith('github', context); // Method call with context
    });
  });

  describe('Public Client Methods', () => {
    it('should pass context to getProviderToken when called directly', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      const context: MCPContext = {
        userId: 'user123',
      };

      // Call getProviderToken directly
      await client.getProviderToken('github', context);

      // Verify context was passed
      expect(getProviderToken).toHaveBeenCalledWith('github', context);
    });

    it('should pass context to setProviderToken when called directly', async () => {
      const setProviderToken = vi.fn().mockResolvedValue(undefined);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        setProviderToken,
      };

      const client = new MCPClientBase(config);

      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      // Call setProviderToken directly
      await client.setProviderToken('github', mockTokenData, context);

      // Verify context was passed
      expect(setProviderToken).toHaveBeenCalledWith('github', mockTokenData, context);
    });
  });

  describe('Server Namespace', () => {
    it('should pass context to server tool calls', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Mock the internal method
      vi.spyOn(client as any, 'callServerToolInternal').mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      const context: MCPContext = {
        userId: 'user123',
      };

      // Call server namespace method with context
      await (client as any).server.someServerTool({}, { context });

      // Verify callServerToolInternal was called with context
      expect((client as any).callServerToolInternal).toHaveBeenCalledWith(
        'some_server_tool',
        {},
        { context }
      );
    });
  });

  describe('Multi-Tenant Use Cases', () => {
    it('should fetch different tokens for different users', async () => {
      const mockUser1Token: ProviderTokenData = {
        accessToken: 'user1-token',
        refreshToken: 'user1-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      const mockUser2Token: ProviderTokenData = {
        accessToken: 'user2-token',
        refreshToken: 'user2-refresh',
        tokenType: 'Bearer',
        expiresIn: 3600,
      };

      const getProviderToken = vi.fn().mockImplementation((provider: string, context?: MCPContext) => {
        if (context?.userId === 'user1') {
          return Promise.resolve(mockUser1Token);
        } else if (context?.userId === 'user2') {
          return Promise.resolve(mockUser2Token);
        }
        return Promise.resolve(undefined);
      });

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      // Call for user1
      await (client as any).github.listRepos({}, { context: { userId: 'user1' } });
      expect(getProviderToken).toHaveBeenCalledWith('github', { userId: 'user1' });

      // Call for user2
      await (client as any).github.listRepos({}, { context: { userId: 'user2' } });
      expect(getProviderToken).toHaveBeenCalledWith('github', { userId: 'user2' });

      // Verify all calls (2 initial checks + 2 method calls)
      expect(getProviderToken).toHaveBeenCalledTimes(4);
    });

    it('should handle organization-scoped tokens', async () => {
      const getProviderToken = vi.fn().mockImplementation((provider: string, context?: MCPContext) => {
        if (context?.organizationId) {
          return Promise.resolve({
            ...mockTokenData,
            accessToken: `org-${context.organizationId}-token`,
          });
        }
        return Promise.resolve(undefined);
      });

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      // Call with organization context
      await (client as any).github.listRepos({}, { context });

      // Verify organization context was used
      // Note: It's called twice - once during client init (without context) and once for the method call (with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined); // Initial check
      expect(getProviderToken).toHaveBeenCalledWith('github', context); // Method call with context
    });
  });

  describe('Error Handling', () => {
    it('should handle getProviderToken callback errors gracefully', async () => {
      const getProviderToken = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      const context: MCPContext = {
        userId: 'user123',
      };

      // Should not throw, but return undefined
      const result = await client.getProviderToken('github', context);

      expect(result).toBeUndefined();
      expect(getProviderToken).toHaveBeenCalledWith('github', context);
    });

    it('should handle setProviderToken callback errors', async () => {
      const setProviderToken = vi.fn().mockRejectedValue(new Error('Database write failed'));

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        setProviderToken,
      };

      const client = new MCPClientBase(config);

      const context: MCPContext = {
        userId: 'user123',
      };

      // Should throw the error
      await expect(
        client.setProviderToken('github', mockTokenData, context)
      ).rejects.toThrow('Database write failed');

      expect(setProviderToken).toHaveBeenCalledWith('github', mockTokenData, context);
    });
  });

  describe('Context with Undefined/Null Values', () => {
    it('should handle undefined context fields', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      const context: MCPContext = {
        userId: 'user123',
        organizationId: undefined,
        sessionId: undefined,
      };

      await (client as any).github.listRepos({}, { context });

      // Verify getProviderToken was called with the context
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined); // Initial check during construction
      expect(getProviderToken).toHaveBeenCalledWith('github', context); // Method call with context
    });

    it('should handle empty context object', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Ensure transport headers include the API key
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      const context: MCPContext = {};

      await (client as any).github.listRepos({}, { context });

      // Verify getProviderToken was called with the context
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', undefined); // Initial check during construction
      expect(getProviderToken).toHaveBeenCalledWith('github', context); // Method call with context
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without any token callbacks', async () => {
      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Mock at callToolThroughHandler level
      vi.spyOn(client as any, 'callToolThroughHandler').mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      // Should not throw even without callbacks
      await expect((client as any).github.listRepos({})).resolves.toBeDefined();
    });

    it('should work with callbacks that do not use context parameter', async () => {
      // Old-style callback that ignores the context parameter
      const getProviderToken = vi.fn((provider: string) => {
        return Promise.resolve(mockTokenData);
      });

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        getProviderToken: getProviderToken as any,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools so the check passes
      (client as any).enabledToolNames.add('github_list_repos');

      // Mock at callToolThroughHandler level
      vi.spyOn(client as any, 'callToolThroughHandler').mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }],
      });

      const context: MCPContext = {
        userId: 'user123',
      };

      // Should work even with context passed to old-style callback
      await (client as any).github.listRepos({}, { context });

      expect(getProviderToken).toHaveBeenCalled();
    });
  });
});

