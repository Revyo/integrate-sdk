/**
 * OpenAI Integration Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { createSimpleIntegration } from "../../src/integrations/generic.js";
import {
  getOpenAITools,
  handleOpenAIResponse,
  type OpenAITool,
} from "../../src/ai/openai.js";
import type { MCPTool } from "../../src/protocol/messages.js";
import type { OpenAI } from "openai";

describe("OpenAI Integration", () => {
  describe("convertMCPToolToOpenAI (via getOpenAITools)", () => {
    test("converts MCP tool to OpenAI format", async () => {
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
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getOpenAITools(client);
      const openaiTool = tools.find((t) => t.name === "test_tool");

      expect(openaiTool).toBeDefined();
      expect(openaiTool?.type).toBe("function");
      expect(openaiTool?.name).toBe("test_tool");
      expect(openaiTool?.description).toBe("A test tool");
      expect(openaiTool?.parameters).toBeDefined();
      expect(openaiTool?.strict).toBeNull();
    });

    test("uses null description if description is missing", async () => {
      const mockTool: MCPTool = {
        name: "test_tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getOpenAITools(client);
      const openaiTool = tools.find((t) => t.name === "test_tool");

      expect(openaiTool?.description).toBeNull();
    });

    test("handles null inputSchema", async () => {
      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: null as any,
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getOpenAITools(client);
      const openaiTool = tools.find((t) => t.name === "test_tool");

      expect(openaiTool?.parameters).toBeNull();
    });

    test("respects strict mode option", async () => {
      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test",
        inputSchema: { type: "object", properties: {} },
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getOpenAITools(client, { strict: true });
      const openaiTool = tools.find((t) => t.name === "test_tool");

      expect(openaiTool?.strict).toBe(true);
    });

    test("converts complex JSON schema correctly", async () => {
      const complexSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["name"],
      };

      const mockTool: MCPTool = {
        name: "complex_tool",
        description: "Complex tool",
        inputSchema: complexSchema,
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["complex_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getOpenAITools(client);
      const openaiTool = tools.find((t) => t.name === "complex_tool");

      expect(openaiTool?.parameters).toEqual(complexSchema);
    });
  });

  describe("getOpenAITools", () => {
    let client: ReturnType<typeof createMCPClient>;

    beforeEach(() => {
      client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["tool1", "tool2"],
          }),
        ],
      });

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
      ];

      (client as any).availableTools = new Map(
        mockTools.map((tool) => [tool.name, tool])
      );
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };
    });

    test("converts all enabled tools", async () => {
      const tools = await getOpenAITools(client);

      expect(tools).toHaveLength(2);
      expect(tools.some((t) => t.name === "tool1")).toBe(true);
      expect(tools.some((t) => t.name === "tool2")).toBe(true);
    });

    test("ensures client is connected", async () => {
      let connectCalled = false;
      (client as any).transport = {
        isConnected: () => false,
      };
      client.connect = async () => {
        connectCalled = true;
        (client as any).transport = { isConnected: () => true };
      };

      await getOpenAITools(client);
      expect(connectCalled).toBe(true);
    });

    test("works without provider tokens (client-side usage)", async () => {
      const tools = await getOpenAITools(client);
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });

    test("uses provided provider tokens", async () => {
      const tools = await getOpenAITools(client, {
        providerTokens: { github: "test_token_123" },
      });

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe("handleOpenAIToolCalls (via handleOpenAIResponse)", () => {
    let client: ReturnType<typeof createMCPClient>;

    beforeEach(() => {
      client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["test_tool"],
          }),
        ],
      });

      const mockTool: MCPTool = {
        name: "test_tool",
        description: "Test tool",
        inputSchema: { type: "object", properties: {} },
      };

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };
    });

    test("executes function calls from response output", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_123",
            call_id: "call_123",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test" }),
          },
        ],
      };

      let executedTool: { name: string; args: any } | null = null;
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        executedTool = { name, args };
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs.length).toBe(1);
        expect(toolOutputs[0].type).toBe("function_call_output");
        expect(toolOutputs[0].call_id).toBe("call_123");
        expect(toolOutputs[0].status).toBe("completed");
        expect(executedTool?.name).toBe("test_tool");
        expect(executedTool?.args).toEqual({ input: "test" });
      }
    });

    test("handles multiple function calls", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_1",
            call_id: "call_1",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test1" }),
          },
          {
            type: "function_call",
            id: "call_2",
            call_id: "call_2",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test2" }),
          },
        ],
      };

      const executedCalls: string[] = [];
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        executedCalls.push(JSON.stringify(args));
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs.length).toBe(2);
        expect(executedCalls.length).toBe(2);
      }
    });

    test("handles tool execution errors", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_123",
            call_id: "call_123",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test" }),
          },
        ],
      };

      client._callToolByName = async () => {
        throw new Error("Tool execution failed");
      };

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs.length).toBe(1);
        expect(toolOutputs[0].status).toBe("incomplete");
        expect(toolOutputs[0].output).toContain("Tool execution failed");
      }
    });

    test("returns original response if no function calls", async () => {
      const mockResponse = {
        output: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      };

      const result = await handleOpenAIResponse(client, mockResponse);

      expect(result).toEqual(mockResponse);
    });

    test("filters out non-function-call items", async () => {
      const mockResponse = {
        output: [
          {
            type: "text",
            text: "Some text",
          },
          {
            type: "function_call",
            id: "call_123",
            call_id: "call_123",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test" }),
          },
        ],
      };

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs.length).toBe(1);
        expect(toolOutputs[0].type).toBe("function_call_output");
      }
    });

    test("uses provider tokens when provided", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_123",
            call_id: "call_123",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test" }),
          },
        ],
      };

      let toolExecuted = false;
      (client as any).getProviderForTool = () => "github";
      (client as any).oauthManager = {
        setProviderToken: () => {},
        getProviderToken: async () => undefined,
        removeProviderToken: () => {},
      };

      client._callToolByName = async () => {
        toolExecuted = true;
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const result = await handleOpenAIResponse(client, mockResponse, {
        providerTokens: { github: "test_token_123" },
      });

      expect(toolExecuted).toBe(true);
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0].status).toBe("completed");
      }
    });

    test("handles missing call_id by using id", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_123",
            name: "test_tool",
            arguments: JSON.stringify({ input: "test" }),
          },
        ],
      };

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs[0].call_id).toBe("call_123");
      }
    });

    test("handles invalid JSON arguments gracefully", async () => {
      const mockResponse = {
        output: [
          {
            type: "function_call",
            id: "call_123",
            call_id: "call_123",
            name: "test_tool",
            arguments: "invalid json{",
          },
        ],
      };

      const toolOutputs = await handleOpenAIResponse(client, mockResponse);

      expect(Array.isArray(toolOutputs)).toBe(true);
      if (Array.isArray(toolOutputs)) {
        expect(toolOutputs[0].status).toBe("incomplete");
        expect(toolOutputs[0].output).toBeDefined();
      }
    });
  });
});

