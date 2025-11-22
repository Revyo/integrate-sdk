/**
 * Google GenAI Integration Tests
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { createSimpleIntegration } from "../../src/integrations/generic.js";
import {
  getGoogleTools,
  executeGoogleFunctionCalls,
  type GoogleTool,
  type GoogleFunctionCall,
} from "../../src/ai/google.js";
import type { MCPTool } from "../../src/protocol/messages.js";

describe("Google GenAI Integration", () => {
  // Helper to check if @google/genai is available
  async function isGoogleGenAIAvailable(): Promise<boolean> {
    try {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const packageName = '@' + 'google' + '/' + 'genai';
      await dynamicImport(packageName);
      return true;
    } catch {
      return false;
    }
  }

  describe("convertMCPToolToGoogle (via getGoogleTools)", () => {
    test("converts MCP tool to Google format", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

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

      const tools = await getGoogleTools(client);
      const googleTool = tools.find((t) => t.name === "test_tool");

      expect(googleTool).toBeDefined();
      expect(googleTool?.name).toBe("test_tool");
      expect(googleTool?.description).toBe("A test tool");
      expect(googleTool?.parameters).toBeDefined();
      expect(googleTool?.parameters.type).toBeDefined();
      expect(googleTool?.parameters.properties).toBeDefined();
    });

    test("uses default description if description is missing", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

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

      const tools = await getGoogleTools(client);
      const googleTool = tools.find((t) => t.name === "test_tool");

      expect(googleTool?.description).toBe("Execute test_tool");
    });

    test("handles null inputSchema", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

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

      const tools = await getGoogleTools(client);
      const googleTool = tools.find((t) => t.name === "test_tool");

      expect(googleTool?.parameters.type).toBeDefined();
      expect(googleTool?.parameters.properties).toBeDefined();
    });

    test("converts JSON schema types to Google Type enum", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

      const mockTool: MCPTool = {
        name: "type_test_tool",
        description: "Type test",
        inputSchema: {
          type: "object",
          properties: {
            str: { type: "string" },
            num: { type: "number" },
            int: { type: "integer" },
            bool: { type: "boolean" },
            arr: { type: "array", items: { type: "string" } },
          },
        },
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["type_test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getGoogleTools(client);
      const googleTool = tools.find((t) => t.name === "type_test_tool");

      expect(googleTool?.parameters.properties).toBeDefined();
      const props = googleTool?.parameters.properties;
      if (props) {
        // Just verify types are set (actual enum values depend on @google/genai)
        expect(props.str?.type).toBeDefined();
        expect(props.num?.type).toBeDefined();
        expect(props.int?.type).toBeDefined();
        expect(props.bool?.type).toBeDefined();
        expect(props.arr?.type).toBeDefined();
      }
    });

    test("handles required fields", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

      const mockTool: MCPTool = {
        name: "required_test_tool",
        description: "Required test",
        inputSchema: {
          type: "object",
          properties: {
            required_field: { type: "string" },
            optional_field: { type: "string" },
          },
          required: ["required_field"],
        },
      };

      const client = createMCPClient({
        integrations: [
          createSimpleIntegration({
            id: "test",
            tools: ["required_test_tool"],
          }),
        ],
      });

      (client as any).availableTools = new Map([[mockTool.name, mockTool]]);
      (client as any).initialized = true;
      (client as any).transport = { isConnected: () => true };

      const tools = await getGoogleTools(client);
      const googleTool = tools.find((t) => t.name === "required_test_tool");

      expect((googleTool?.parameters as any).required).toEqual(["required_field"]);
    });
  });

  describe("getGoogleTools", () => {
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
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

      const tools = await getGoogleTools(client);

      expect(tools).toHaveLength(2);
      expect(tools.some((t) => t.name === "tool1")).toBe(true);
      expect(tools.some((t) => t.name === "tool2")).toBe(true);
    });

    test("ensures client is connected", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

      let connectCalled = false;
      (client as any).transport = {
        isConnected: () => false,
      };
      client.connect = async () => {
        connectCalled = true;
        (client as any).transport = { isConnected: () => true };
      };

      await getGoogleTools(client);
      expect(connectCalled).toBe(true);
    });

    test("uses provided provider tokens", async () => {
      if (!(await isGoogleGenAIAvailable())) {
        console.log("Skipping test: @google/genai not installed");
        return;
      }

      const tools = await getGoogleTools(client, {
        providerTokens: { github: "test_token_123" },
      });

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe("executeGoogleFunctionCalls", () => {
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

    test("executes function calls and returns JSON string results", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test" },
        } as any,
      ];

      let executedTool: { name: string; args: any } | null = null;
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        executedTool = { name, args };
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const results = await executeGoogleFunctionCalls(client, functionCalls);

      expect(results).toHaveLength(1);
      expect(executedTool?.name).toBe("test_tool");
      expect(executedTool?.args).toEqual({ input: "test" });
      expect(typeof results[0]).toBe("string");
      const parsed = JSON.parse(results[0]);
      expect(parsed).toBeDefined();
    });

    test("handles multiple function calls", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test1" },
        } as any,
        {
          name: "test_tool",
          args: { input: "test2" },
        } as any,
      ];

      const executedCalls: string[] = [];
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        executedCalls.push(JSON.stringify(args));
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const results = await executeGoogleFunctionCalls(client, functionCalls);

      expect(results).toHaveLength(2);
      expect(executedCalls.length).toBe(2);
    });

    test("returns empty array for null or undefined function calls", async () => {
      expect(await executeGoogleFunctionCalls(client, null)).toEqual([]);
      expect(await executeGoogleFunctionCalls(client, undefined)).toEqual([]);
      expect(await executeGoogleFunctionCalls(client, [])).toEqual([]);
    });

    test("handles function calls without name", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          args: { input: "test" },
        } as any,
      ];

      await expect(
        executeGoogleFunctionCalls(client, functionCalls)
      ).rejects.toThrow("Function call must have a name");
    });

    test("handles tool execution errors", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test" },
        } as any,
      ];

      client._callToolByName = async () => {
        throw new Error("Tool execution failed");
      };

      await expect(
        executeGoogleFunctionCalls(client, functionCalls)
      ).rejects.toThrow("Tool execution failed");
    });

    test("uses provider tokens when provided", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test" },
        } as any,
      ];

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

      const results = await executeGoogleFunctionCalls(client, functionCalls, {
        providerTokens: { github: "test_token_123" },
      });

      expect(toolExecuted).toBe(true);
      expect(results.length).toBe(1);
    });

    test("handles function calls with missing args", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          // No args property
        } as any,
      ];

      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      const results = await executeGoogleFunctionCalls(client, functionCalls);

      expect(results).toHaveLength(1);
      // Should handle missing args gracefully
      expect(results[0]).toBeDefined();
    });

    test("formats results as JSON strings", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test" },
        } as any,
      ];

      const mockResult = {
        content: [{ type: "text", text: "success" }],
        isError: false,
      };

      client._callToolByName = async () => mockResult;

      const results = await executeGoogleFunctionCalls(client, functionCalls);

      expect(results[0]).toBe(JSON.stringify(mockResult));
    });

    test("executes calls in parallel", async () => {
      const functionCalls: GoogleFunctionCall[] = [
        {
          name: "test_tool",
          args: { input: "test1" },
        } as any,
        {
          name: "test_tool",
          args: { input: "test2" },
        } as any,
        {
          name: "test_tool",
          args: { input: "test3" },
        } as any,
      ];

      const executionOrder: number[] = [];
      client._callToolByName = async (name: string, args?: Record<string, unknown>) => {
        const input = (args as any)?.input;
        if (input === "test1") executionOrder.push(1);
        if (input === "test2") executionOrder.push(2);
        if (input === "test3") executionOrder.push(3);
        return {
          content: [{ type: "text", text: "success" }],
          isError: false,
        };
      };

      await executeGoogleFunctionCalls(client, functionCalls);

      // All should execute (order may vary due to parallel execution)
      expect(executionOrder.length).toBe(3);
      expect(executionOrder).toContain(1);
      expect(executionOrder).toContain(2);
      expect(executionOrder).toContain(3);
    });
  });
});

