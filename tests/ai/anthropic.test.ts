/**
 * Anthropic Integration Tests
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { createSimpleIntegration } from "../../src/integrations/generic.js";
import {
  getAnthropicTools,
  handleAnthropicMessage,
  type AnthropicTool,
  type AnthropicToolUseBlock,
  type AnthropicToolResultBlock,
} from "../../src/ai/anthropic.js";
import type { MCPTool } from "../../src/protocol/messages.js";

describe("Anthropic Integration", () => {
  describe("convertMCPToolToAnthropic (via getAnthropicTools)", () => {
    test("converts MCP tool to Anthropic format", async () => {
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

      const tools = await getAnthropicTools(client);
      const anthropicTool = tools.find((t) => t.name === "test_tool");

      expect(anthropicTool).toBeDefined();
      expect(anthropicTool?.name).toBe("test_tool");
      expect(anthropicTool?.description).toBe("A test tool");
      expect(anthropicTool?.input_schema).toBeDefined();
      expect(anthropicTool?.input_schema.type).toBe("object");
      expect(anthropicTool?.input_schema.properties).toBeDefined();
    });

    test("uses default description if description is missing", async () => {
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

      const tools = await getAnthropicTools(client);
      const anthropicTool = tools.find((t) => t.name === "test_tool");

      expect(anthropicTool?.description).toBe("Execute test_tool");
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

      const tools = await getAnthropicTools(client);
      const anthropicTool = tools.find((t) => t.name === "test_tool");

      expect(anthropicTool?.input_schema.type).toBe("object");
      expect(anthropicTool?.input_schema.properties).toEqual({});
      expect(anthropicTool?.input_schema.required).toEqual([]);
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

      const tools = await getAnthropicTools(client);
      const anthropicTool = tools.find((t) => t.name === "complex_tool");

      expect(anthropicTool?.input_schema.type).toBe("object");
      expect(anthropicTool?.input_schema.properties).toBeDefined();
      expect(anthropicTool?.input_schema.required).toEqual(["name"]);
    });
  });

  describe("getAnthropicTools", () => {
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
      const tools = await getAnthropicTools(client);

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

      await getAnthropicTools(client);
      expect(connectCalled).toBe(true);
    });

    test("uses provided provider tokens", async () => {
      const tools = await getAnthropicTools(client, {
        providerTokens: { github: "test_token_123" },
      });

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe("handleAnthropicToolCalls (via handleAnthropicMessage)", () => {
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

    test("executes tool use blocks from message content", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            input: { input: "test" },
          },
        ],
      };

      let executedTool: { name: string; input: any } | null = null;
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        executedTool = { name, input: args };
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result.length).toBe(2);
        // First message should be the assistant message with tool use
        expect(result[0].role).toBe("assistant");
        // Second message should be user message with tool results
        expect(result[1].role).toBe("user");
        expect(Array.isArray(result[1].content)).toBe(true);
        const toolResults = result[1].content as AnthropicToolResultBlock[];
        expect(toolResults.length).toBe(1);
        expect(toolResults[0].type).toBe("tool_result");
        expect(toolResults[0].tool_use_id).toBe("toolu_123");
        expect(executedTool?.name).toBe("test_tool");
        expect(executedTool?.input).toEqual({ input: "test" });
      }
    });

    test("handles multiple tool use blocks", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "test_tool",
            input: { input: "test1" },
          },
          {
            type: "tool_use",
            id: "toolu_2",
            name: "test_tool",
            input: { input: "test2" },
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

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[1].role).toBe("user");
        const toolResults = result[1].content as AnthropicToolResultBlock[];
        expect(toolResults.length).toBe(2);
        expect(executedCalls.length).toBe(2);
      }
    });

    test("handles tool execution errors", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            input: { input: "test" },
          },
        ],
      };

      client._callToolByName = async () => {
        throw new Error("Tool execution failed");
      };

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        const toolResults = result[1].content as AnthropicToolResultBlock[];
        expect(toolResults.length).toBe(1);
        expect(toolResults[0].type).toBe("tool_result");
        const errorContent = JSON.parse(toolResults[0].content);
        expect(errorContent.error).toContain("Tool execution failed");
      }
    });

    test("returns original message if no tool use blocks", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      };

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(result).toEqual(mockMessage);
    });

    test("filters out non-tool-use blocks", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Some text",
          },
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            input: { input: "test" },
          },
        ],
      };

      client._callToolByName = async () => ({
        content: [{ type: "text", text: "success" }],
        isError: false,
      });

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        // Should include both text and tool_use in assistant message
        expect(result[0].content.length).toBe(2);
        // But only execute the tool_use
        const toolResults = result[1].content as AnthropicToolResultBlock[];
        expect(toolResults.length).toBe(1);
      }
    });

    test("uses provider tokens when provided", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            input: { input: "test" },
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

      const result = await handleAnthropicMessage(client, mockMessage, {
        providerTokens: { github: "test_token_123" },
      });

      expect(toolExecuted).toBe(true);
      expect(Array.isArray(result)).toBe(true);
    });

    test("handles invalid tool use blocks gracefully", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            // Missing input field
          } as any,
        ],
      };

      const result = await handleAnthropicMessage(client, mockMessage);

      // Should still return a result, even if the tool use block is invalid
      expect(result).toBeDefined();
    });

    test("formats tool results as JSON strings", async () => {
      const mockMessage = {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "test_tool",
            input: { input: "test" },
          },
        ],
      };

      const mockResult = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };

      client._callToolByName = async () => mockResult;

      const result = await handleAnthropicMessage(client, mockMessage);

      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        const toolResults = result[1].content as AnthropicToolResultBlock[];
        expect(toolResults[0].content).toBe(JSON.stringify(mockResult));
      }
    });
  });
});

