/**
 * Vercel AI SDK Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { z } from "zod";
import { createMCPClient } from "../../src/client.js";
import { createSimplePlugin } from "../../src/plugins/generic.js";
import {
  convertMCPToolToVercelAI,
  convertMCPToolsToVercelAI,
  getVercelAITools,
} from "../../src/integrations/vercel-ai.js";
import type { MCPTool } from "../../src/protocol/messages.js";

describe("Vercel AI SDK Integration", () => {
  describe("convertMCPToolToVercelAI", () => {
    test("converts MCP tool to Vercel AI format with Zod schema", async () => {
      const mockTool: MCPTool = {
        name: "test_tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "Test input",
            },
          },
          required: ["input"],
        },
      };

      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);

      expect(vercelTool).toBeDefined();
      expect(vercelTool.description).toBe("A test tool");
      // Verify it's a Zod schema
      expect(vercelTool.inputSchema).toBeDefined();
      expect(vercelTool.inputSchema._def).toBeDefined();
      expect(vercelTool.inputSchema._def.typeName).toBe("ZodObject");
      // Test that the schema can parse valid input
      const result = vercelTool.inputSchema.safeParse({ input: "test" });
      expect(result.success).toBe(true);
      expect(vercelTool.execute).toBeFunction();
    });

    test("uses tool name in description if description is missing", async () => {
      const mockTool: MCPTool = {
        name: "test_tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      };

      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);

      expect(vercelTool.description).toBe("Execute test_tool");
      // Verify it returns a Zod object schema even with no properties
      expect(vercelTool.inputSchema._def.typeName).toBe("ZodObject");
    });

    test("converts complex JSON schema to Zod", async () => {
      const complexSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number", minimum: 0 },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          metadata: {
            type: "object",
            properties: {
              created: { type: "string", format: "date-time" },
            },
          },
        },
        required: ["name", "age"],
      };

      const mockTool: MCPTool = {
        name: "complex_tool",
        description: "Complex tool",
        inputSchema: complexSchema,
      };

      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["complex_tool"],
          }),
        ],
      });

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);

      // Verify it's a Zod object schema
      expect(vercelTool.inputSchema._def.typeName).toBe("ZodObject");
      
      // Test with valid data
      const validData = {
        name: "John",
        age: 30,
        tags: ["tag1", "tag2"],
        metadata: { created: "2023-01-01" },
      };
      const result = vercelTool.inputSchema.safeParse(validData);
      expect(result.success).toBe(true);
      
      // Test that required fields are enforced
      const invalidData = { tags: ["tag1"] }; // missing required name and age
      const invalidResult = vercelTool.inputSchema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("convertMCPToolsToVercelAI", () => {
    let client: ReturnType<typeof createMCPClient>;

    beforeAll(async () => {
      client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["tool1", "tool2", "tool3"],
          }),
        ],
      });

      // Mock the client's available tools
      const mockTools: MCPTool[] = [
        {
          name: "tool1",
          description: "First tool",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "tool2",
          description: "Second tool",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "tool3",
          description: "Third tool",
          inputSchema: { type: "object", properties: {} },
        },
      ];

      // Manually set the tools (simulating what happens after connect)
      (client as any).availableTools = new Map(
        mockTools.map((tool) => [tool.name, tool])
      );
      (client as any).initialized = true;
    });

    test("converts all enabled tools", () => {
      const vercelTools = convertMCPToolsToVercelAI(client);

      expect(Object.keys(vercelTools)).toHaveLength(3);
      expect(vercelTools["tool1"]).toBeDefined();
      expect(vercelTools["tool2"]).toBeDefined();
      expect(vercelTools["tool3"]).toBeDefined();
    });

    test("each converted tool has required properties", () => {
      const vercelTools = convertMCPToolsToVercelAI(client);

      for (const [name, tool] of Object.entries(vercelTools)) {
        expect(tool.description).toBeString();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.execute).toBeFunction();
      }
    });

    test("tool names match original MCP tool names", () => {
      const vercelTools = convertMCPToolsToVercelAI(client);

      expect(vercelTools).toHaveProperty("tool1");
      expect(vercelTools).toHaveProperty("tool2");
      expect(vercelTools).toHaveProperty("tool3");
    });
  });

  describe("getVercelAITools", () => {
    test("is an alias for convertMCPToolsToVercelAI", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const result1 = await getVercelAITools(client);
      const result2 = convertMCPToolsToVercelAI(client);

      expect(Object.keys(result1)).toEqual(Object.keys(result2));
      expect(result1["test_tool"].description).toBe(
        result2["test_tool"].description
      );
    });
  });

  describe("Tool execution", () => {
    test("execute calls client._callToolByName with correct arguments", async () => {
      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;

      // Mock _callToolByName to track calls
      let calledWith: any = null;
      const originalCallToolByName = client._callToolByName.bind(client);
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        calledWith = { name, args };
        return {
          content: [{ type: "text", text: "mocked response" }],
          isError: false,
        };
      };

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);
      const testArgs = { input: "test value" };
      await vercelTool.execute(testArgs);

      expect(calledWith).toBeDefined();
      expect(calledWith.name).toBe("test_tool");
      expect(calledWith.args).toEqual(testArgs);
    });

    test("execute returns result from _callToolByName", async () => {
      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;

      const mockResponse = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };

      client._callToolByName = async () => mockResponse;

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);
      const result = await vercelTool.execute({ input: "test" });

      expect(result).toEqual(mockResponse);
    });
  });

  describe("Schema normalization to Zod", () => {
    test("handles type: 'None' schema and converts to z.object()", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { 
          type: "None" as any, // Invalid type that some tools might have
          properties: { id: { type: "string" } },
        },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getVercelAITools(client);
      
      // Should normalize to proper Zod object schema
      expect(tools["test_tool"].inputSchema._def.typeName).toBe("ZodObject");
      // Should be able to parse with the id property
      const result = tools["test_tool"].inputSchema.safeParse({ id: "123" });
      expect(result.success).toBe(true);
    });

    test("handles missing type in schema", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { 
          properties: { name: { type: "string" } },
          // No type field
        } as any,
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getVercelAITools(client);
      
      // Should convert to Zod object schema
      expect(tools["test_tool"].inputSchema._def.typeName).toBe("ZodObject");
      const result = tools["test_tool"].inputSchema.safeParse({ name: "test" });
      expect(result.success).toBe(true);
    });

    test("handles null or invalid schema", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: null as any,
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getVercelAITools(client);
      
      // Should provide safe default Zod empty object schema
      expect(tools["test_tool"].inputSchema._def.typeName).toBe("ZodObject");
      // Empty object should accept empty input
      const result = tools["test_tool"].inputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test("converts valid object schema to Zod correctly", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const validSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          count: { type: "number" },
        },
        required: ["title"],
      };

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: validSchema,
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getVercelAITools(client);
      
      // Should convert to Zod schema
      expect(tools["test_tool"].inputSchema._def.typeName).toBe("ZodObject");
      
      // Test valid data
      const validData = { title: "Test", count: 5 };
      expect(tools["test_tool"].inputSchema.safeParse(validData).success).toBe(true);
      
      // Test missing required field
      const invalidData = { count: 5 };
      expect(tools["test_tool"].inputSchema.safeParse(invalidData).success).toBe(false);
      
      // Test optional field (count is not required)
      const partialData = { title: "Test" };
      expect(tools["test_tool"].inputSchema.safeParse(partialData).success).toBe(true);
    });
  });

  describe("Server-side token passing", () => {
    test("accepts providerTokens option in getVercelAITools", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "github",
            tools: ["github_create_issue"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "github_create_issue",
        description: "Create issue",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getVercelAITools(client, {
        providerTokens: { github: "test_token_123" },
      });

      expect(tools).toBeDefined();
      expect(tools["github_create_issue"]).toBeDefined();
    });

    test("injects provider token in Authorization header during tool execution", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "github",
            tools: ["github_create_issue"],
            oauth: {
              provider: "github",
              clientId: "test",
              clientSecret: "test",
              scopes: [],
            },
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "github_create_issue",
        description: "Create issue",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;

      // Mock transport to track header changes
      const mockTransport = {
        headers: {},
        setHeader: function(key: string, value: string) {
          this.headers[key] = value;
        },
        removeHeader: function(key: string) {
          delete this.headers[key];
        },
        isConnected: function() {
          return true;
        },
      };
      (client as any).transport = mockTransport;

      // Mock getProviderForTool
      (client as any).getProviderForTool = (toolName: string) => {
        return "github";
      };

      let headerDuringExecution: string | undefined;
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        // Capture the Authorization header during execution
        headerDuringExecution = mockTransport.headers['Authorization'];
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const tools = await getVercelAITools(client, {
        providerTokens: { github: "test_token_123" },
      });

      await tools["github_create_issue"].execute({ title: "Test" });

      // Verify that the Authorization header was set during execution
      expect(headerDuringExecution).toBe("Bearer test_token_123");
    });

    test("cleans up Authorization header after tool execution", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "github",
            tools: ["github_create_issue"],
            oauth: {
              provider: "github",
              clientId: "test",
              clientSecret: "test",
              scopes: [],
            },
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "github_create_issue",
        description: "Create issue",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;

      // Mock transport
      const mockTransport = {
        headers: {},
        setHeader: function(key: string, value: string) {
          this.headers[key] = value;
        },
        removeHeader: function(key: string) {
          delete this.headers[key];
        },
        isConnected: function() {
          return true;
        },
      };
      (client as any).transport = mockTransport;
      (client as any).getProviderForTool = () => "github";

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      const tools = await getVercelAITools(client, {
        providerTokens: { github: "test_token_123" },
      });

      await tools["github_create_issue"].execute({ title: "Test" });

      // Verify that the Authorization header was cleaned up
      expect(mockTransport.headers['Authorization']).toBeUndefined();
    });

    test("uses correct token for each provider", async () => {
      const client = createMCPClient({
        plugins: [
          createSimplePlugin({
            id: "github",
            tools: ["github_create_issue"],
            oauth: {
              provider: "github",
              clientId: "test",
              clientSecret: "test",
              scopes: [],
            },
          }),
          createSimplePlugin({
            id: "gmail",
            tools: ["gmail_send_email"],
            oauth: {
              provider: "gmail",
              clientId: "test",
              clientSecret: "test",
              scopes: [],
            },
          }),
        ],
      });

      const githubTool: MCPTool = {
        name: "github_create_issue",
        description: "Create issue",
        inputSchema: { type: "object", properties: {} },
      };

      const gmailTool: MCPTool = {
        name: "gmail_send_email",
        description: "Send email",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([
        [githubTool.name, githubTool],
        [gmailTool.name, gmailTool],
      ]);
      (client as any).initialized = true;

      const mockTransport = {
        headers: {},
        setHeader: function(key: string, value: string) {
          this.headers[key] = value;
        },
        removeHeader: function(key: string) {
          delete this.headers[key];
        },
        isConnected: function() {
          return true;
        },
      };
      (client as any).transport = mockTransport;

      // Mock getProviderForTool to return correct provider
      (client as any).getProviderForTool = (toolName: string) => {
        if (toolName.startsWith("github")) return "github";
        if (toolName.startsWith("gmail")) return "gmail";
        return undefined;
      };

      const executionTokens: Record<string, string> = {};
      client._callToolByName = async (name: string) => {
        executionTokens[name] = mockTransport.headers['Authorization'] || '';
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const tools = await getVercelAITools(client, {
        providerTokens: {
          github: "github_token_123",
          gmail: "gmail_token_456",
        },
      });

      await tools["github_create_issue"].execute({ title: "Test" });
      await tools["gmail_send_email"].execute({ to: "test@example.com" });

      // Verify correct tokens were used
      expect(executionTokens["github_create_issue"]).toBe("Bearer github_token_123");
      expect(executionTokens["gmail_send_email"]).toBe("Bearer gmail_token_456");
    });

    test("works without providerTokens option (client-side usage)", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      // Call without providerTokens option
      const tools = await getVercelAITools(client);
      const result = await tools["test_tool"].execute({ input: "test" });

      expect(result).toBeDefined();
    });

    test("handles missing provider token gracefully", async () => {
      const client = createMCPClient({
        singleton: false,
        plugins: [
          createSimplePlugin({
            id: "github",
            tools: ["github_create_issue"],
            oauth: {
              provider: "github",
              clientId: "test",
              clientSecret: "test",
              scopes: [],
            },
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "github_create_issue",
        description: "Create issue",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      
      // Mock transport
      const mockTransport = {
        headers: {},
        setHeader: function(key: string, value: string) {
          this.headers[key] = value;
        },
        removeHeader: function(key: string) {
          delete this.headers[key];
        },
        isConnected: function() {
          return true;
        },
      };
      (client as any).transport = mockTransport;
      (client as any).getProviderForTool = () => "github";

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      // Call with providerTokens but missing the github token
      const tools = await getVercelAITools(client, {
        providerTokens: { gmail: "gmail_token_123" }, // No github token
      });

      // Should still execute without error (falls back to default behavior)
      const result = await tools["github_create_issue"].execute({ title: "Test" });
      expect(result).toBeDefined();
    });
  });
});

