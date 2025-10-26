/**
 * Vercel AI SDK Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
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
    test("converts MCP tool to Vercel AI format", async () => {
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
      expect(vercelTool.parameters).toEqual(mockTool.inputSchema);
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
    });

    test("preserves complex JSON schema", async () => {
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

      expect(vercelTool.parameters).toEqual(complexSchema);
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
        expect(tool.parameters).toBeDefined();
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
    test("is an alias for convertMCPToolsToVercelAI", () => {
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

      const result1 = getVercelAITools(client);
      const result2 = convertMCPToolsToVercelAI(client);

      expect(Object.keys(result1)).toEqual(Object.keys(result2));
      expect(result1["test_tool"].description).toBe(
        result2["test_tool"].description
      );
    });
  });

  describe("Tool execution", () => {
    test("execute calls client.callTool with correct arguments", async () => {
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

      // Mock callTool to track calls
      let calledWith: any = null;
      const originalCallTool = client.callTool.bind(client);
      client.callTool = async (name: string, args?: Record<string, unknown>) => {
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

    test("execute returns result from callTool", async () => {
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

      client.callTool = async () => mockResponse;

      const vercelTool = convertMCPToolToVercelAI(mockTool, client);
      const result = await vercelTool.execute({ input: "test" });

      expect(result).toEqual(mockResponse);
    });
  });
});

