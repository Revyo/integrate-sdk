/**
 * Tests for Vercel AI SDK Context Passing
 * Verifies that context is properly passed through getVercelAITools to tool execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPClientBase } from '../../src/client.js';
import { convertMCPToolsToVercelAI } from '../../src/ai/vercel-ai.js';
import type { MCPClientConfig, MCPContext, ProviderTokenData } from '../../src/config/types.js';
import type { MCPIntegration } from '../../src/integrations/types.js';

describe('Vercel AI SDK Context Passing', () => {
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

  // Mock tool object that convertMCPToolsToVercelAI expects
  const mockToolObject = {
    name: 'github_list_repos',
    description: 'List repositories',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: {
          type: 'number',
          description: 'Number of repos per page',
        },
      },
    },
  };

  const mockTokenData: ProviderTokenData = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresIn: 3600,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getVercelAITools with context', () => {
    it('should pass context through to tool execution', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Mock _callToolByName to verify it receives the context
      const callToolByNameSpy = vi.spyOn(client, '_callToolByName').mockResolvedValue({
        content: [{ type: 'text', text: 'Repository list' }],
      });

      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      // Convert tools with context
      const tools = convertMCPToolsToVercelAI(client, { context });

      // Execute the tool
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify _callToolByName was called with the context
      expect(callToolByNameSpy).toHaveBeenCalledWith(
        'github_list_repos',
        { per_page: 10 },
        { context }
      );
    });

    it('should work without context for backward compatibility', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Mock _callToolByName
      const callToolByNameSpy = vi.spyOn(client, '_callToolByName').mockResolvedValue({
        content: [{ type: 'text', text: 'Repository list' }],
      });

      // Convert tools without context
      const tools = convertMCPToolsToVercelAI(client);

      // Execute the tool
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify _callToolByName was called without context
      expect(callToolByNameSpy).toHaveBeenCalledWith(
        'github_list_repos',
        { per_page: 10 },
        undefined
      );
    });

    it('should pass context to getProviderToken when tool is executed', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools
      (client as any).enabledToolNames.add('github_list_repos');

      // Set up transport headers to indicate server-side client
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

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      const context: MCPContext = {
        userId: 'user123',
      };

      // Convert tools with context
      const tools = convertMCPToolsToVercelAI(client, { context });

      // Execute the tool (which should trigger the full call chain)
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify getProviderToken was called with context (2 initial + 1 with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', context);
    });

    it('should support multi-user scenarios with different contexts', async () => {
      const getProviderToken = vi.fn().mockImplementation((provider: string, context?: MCPContext) => {
        if (context?.userId === 'user1') {
          return Promise.resolve({ ...mockTokenData, accessToken: 'user1-token' });
        } else if (context?.userId === 'user2') {
          return Promise.resolve({ ...mockTokenData, accessToken: 'user2-token' });
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

      // Add the tool to enabled tools
      (client as any).enabledToolNames.add('github_list_repos');

      // Set up transport headers to indicate server-side client
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

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Create tools for user1
      const toolsUser1 = convertMCPToolsToVercelAI(client, {
        context: { userId: 'user1' },
      });

      // Create tools for user2
      const toolsUser2 = convertMCPToolsToVercelAI(client, {
        context: { userId: 'user2' },
      });

      // Execute tool for user1
      await toolsUser1['github_list_repos'].execute({ per_page: 10 });

      // Execute tool for user2
      await toolsUser2['github_list_repos'].execute({ per_page: 10 });

      // Verify both users' contexts were used (2 initial + 2 with context)
      expect(getProviderToken).toHaveBeenCalledWith('github', { userId: 'user1' });
      expect(getProviderToken).toHaveBeenCalledWith('github', { userId: 'user2' });
      expect(getProviderToken).toHaveBeenCalledTimes(4);
    });

    it('should handle empty context object', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Mock _callToolByName
      const callToolByNameSpy = vi.spyOn(client, '_callToolByName').mockResolvedValue({
        content: [{ type: 'text', text: 'Repository list' }],
      });

      // Convert tools with empty context
      const tools = convertMCPToolsToVercelAI(client, { context: {} });

      // Execute the tool
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify _callToolByName was called with empty context
      expect(callToolByNameSpy).toHaveBeenCalledWith(
        'github_list_repos',
        { per_page: 10 },
        { context: {} }
      );
    });

    it('should handle context with custom fields', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools
      (client as any).enabledToolNames.add('github_list_repos');

      // Set up transport headers to indicate server-side client
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

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      const context: MCPContext = {
        userId: 'user123',
        customField1: 'value1',
        customField2: 'value2',
      };

      // Convert tools with custom context fields
      const tools = convertMCPToolsToVercelAI(client, { context });

      // Execute the tool
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify getProviderToken received the full context with custom fields (2 initial + 1 with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', context);
    });
  });

  describe('AI SDK Integration Scenario', () => {
    it('should work in a typical streamText scenario with userId', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools
      (client as any).enabledToolNames.add('github_list_repos');

      // Set up transport headers to indicate server-side client
      if (!(client as any).transport.headers) {
        (client as any).transport.headers = {};
      }
      (client as any).transport.headers['X-API-KEY'] = 'test-api-key';

      // Mock transport methods for server-side path
      (client as any).transport.sendRequest = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Created issue #123' }],
      });
      (client as any).transport.setHeader = vi.fn();
      (client as any).transport.removeHeader = vi.fn();

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Simulate API route handler
      const userId = 'user-from-session';
      const tools = convertMCPToolsToVercelAI(client, {
        context: { userId },
      });

      // Simulate AI model calling the tool
      const result = await tools['github_list_repos'].execute({
        per_page: 5,
      });

      // Verify the result
      expect(result.content[0].text).toBe('Created issue #123');

      // Verify getProviderToken was called with userId (2 initial + 1 with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', { userId });
    });

    it('should support organization context in multi-org apps', async () => {
      const getProviderToken = vi.fn().mockResolvedValue(mockTokenData);

      const config: MCPClientConfig<[typeof mockIntegration]> = {
        integrations: [mockIntegration],
        apiKey: 'test-api-key',
        apiBaseUrl: 'https://api.test.com',
        getProviderToken,
      };

      const client = new MCPClientBase(config);

      // Add the tool to enabled tools
      (client as any).enabledToolNames.add('github_list_repos');

      // Set up transport headers to indicate server-side client
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

      // Mock getEnabledTools to return our mock tool object
      vi.spyOn(client, 'getEnabledTools').mockReturnValue([mockToolObject]);

      // Simulate multi-org scenario
      const context: MCPContext = {
        userId: 'user123',
        organizationId: 'org456',
      };

      const tools = convertMCPToolsToVercelAI(client, { context });

      // Execute tool
      await tools['github_list_repos'].execute({ per_page: 10 });

      // Verify organization context was used (2 initial + 1 with context)
      expect(getProviderToken).toHaveBeenCalledTimes(3);
      expect(getProviderToken).toHaveBeenCalledWith('github', context);
    });
  });
});

