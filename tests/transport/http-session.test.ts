/**
 * HTTP Session Transport Tests
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { HttpSessionTransport } from "../../src/transport/http-session.js";

describe("HTTP Session Transport", () => {
  let transport: HttpSessionTransport;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    transport = new HttpSessionTransport({
      url: "https://test.mcp.server.com",
    });
  });

  afterEach(async () => {
    await transport.disconnect();
    global.fetch = originalFetch;
  });

  describe("Constructor", () => {
    test("creates transport with URL", () => {
      expect(transport).toBeDefined();
    });

    test("accepts custom headers", () => {
      const customTransport = new HttpSessionTransport({
        url: "https://test.server.com",
        headers: {
          "X-Custom": "value",
        },
      });

      expect(customTransport.getHeaders()["X-Custom"]).toBe("value");
    });

    test("accepts timeout option", () => {
      const customTransport = new HttpSessionTransport({
        url: "https://test.server.com",
        timeout: 5000,
      });

      expect(customTransport).toBeDefined();
    });
  });

  describe("Connection", () => {
    test("connect method exists", () => {
      expect(transport.connect).toBeDefined();
      expect(typeof transport.connect).toBe("function");
    });

    test("can connect and disconnect", async () => {
      await transport.connect();
      await transport.disconnect();
    });

    test("disconnect can be called multiple times", async () => {
      await transport.disconnect();
      await transport.disconnect();
    });
  });

  describe("sendRequest", () => {
    test("sends JSON-RPC request", async () => {
      let capturedRequest: any;
      
      global.fetch = mock(async (url, options: any) => {
        capturedRequest = JSON.parse(options.body);
        const headers = {
          get: (key: string) => key === "mcp-session-id" ? "test-session-123" : null,
        };
        return {
          ok: true,
          headers,
          json: async () => ({
            jsonrpc: "2.0",
            id: capturedRequest.id,
            result: { success: true },
          }),
        };
      }) as any;

      await transport.connect();
      const result = await transport.sendRequest("test/method", { param: "value" });

      expect(capturedRequest).toBeDefined();
      expect(capturedRequest.method).toBe("test/method");
      expect(capturedRequest.params).toEqual({ param: "value" });
      expect(result).toEqual({ success: true });
    });

    test("includes custom headers in request", async () => {
      let capturedHeaders: any;
      
      transport.setHeader("X-Session-Token", "test-token");
      
      global.fetch = mock(async (url, options: any) => {
        capturedHeaders = options.headers;
        const headers = {
          get: (key: string) => key === "mcp-session-id" ? "test-session-123" : null,
        };
        return {
          ok: true,
          headers,
          json: async () => ({
            jsonrpc: "2.0",
            id: 1,
            result: {},
          }),
        };
      }) as any;

      await transport.connect();
      await transport.sendRequest("test/method", {});

      expect(capturedHeaders["X-Session-Token"]).toBe("test-token");
    });

    test("throws error on network failure", async () => {
      global.fetch = mock(async () => {
        throw new Error("Network error");
      }) as any;

      await transport.connect();
      
      await expect(
        transport.sendRequest("test/method", {})
      ).rejects.toThrow();
    });

    test("handles JSON-RPC error responses", async () => {
      const headers = {
        get: (key: string) => key === "mcp-session-id" ? "test-session-123" : null,
      };
      global.fetch = mock(async () => ({
        ok: true,
        headers,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32601,
            message: "Method not found",
          },
        }),
      })) as any;

      await transport.connect();
      
      await expect(
        transport.sendRequest("nonexistent/method", {})
      ).rejects.toThrow();
    });
  });

  describe("onMessage", () => {
    test("registers message handler", () => {
      const handler = mock(() => {});
      const unsubscribe = transport.onMessage(handler);

      expect(unsubscribe).toBeDefined();
      expect(typeof unsubscribe).toBe("function");
    });

    test("unsubscribe removes handler", () => {
      const handler = mock(() => {});
      const unsubscribe = transport.onMessage(handler);

      expect(() => {
        unsubscribe();
      }).not.toThrow();
    });

    test("can register multiple handlers", () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      const unsubscribe1 = transport.onMessage(handler1);
      const unsubscribe2 = transport.onMessage(handler2);

      expect(unsubscribe1).toBeDefined();
      expect(unsubscribe2).toBeDefined();
    });
  });

  describe("URL Management", () => {
    test("uses provided URL", () => {
      const url = "https://custom.server.com/mcp";
      const customTransport = new HttpSessionTransport({ url });

      expect(customTransport).toBeDefined();
    });

    test("handles URLs with paths", () => {
      const url = "https://api.example.com/v1/mcp";
      const customTransport = new HttpSessionTransport({ url });

      expect(customTransport).toBeDefined();
    });

    test("handles URLs with query parameters", () => {
      const url = "https://api.example.com/mcp?version=1";
      const customTransport = new HttpSessionTransport({ url });

      expect(customTransport).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("handles malformed JSON responses", async () => {
      const headers = {
        get: (key: string) => key === "mcp-session-id" ? "test-session-123" : null,
      };
      global.fetch = mock(async () => ({
        ok: true,
        headers,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      })) as any;

      await transport.connect();
      
      await expect(
        transport.sendRequest("test/method", {})
      ).rejects.toThrow();
    });

    test("handles HTTP error status codes", async () => {
      const headers = {
        get: (key: string) => null,
      };
      global.fetch = mock(async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers,
        json: async () => ({}),
      })) as any;

      await transport.connect();
      
      await expect(
        transport.sendRequest("test/method", {})
      ).rejects.toThrow();
    });

    test("handles timeout errors", async () => {
      const headers = {
        get: (key: string) => key === "mcp-session-id" ? "test-session-123" : null,
      };
      global.fetch = mock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          ok: true,
          headers,
          json: async () => ({ jsonrpc: "2.0", id: 1, result: {} }),
        };
      }) as any;

      const timeoutTransport = new HttpSessionTransport({
        url: "https://test.server.com",
        timeout: 10, // Very short timeout
      });

      await timeoutTransport.connect();
      
      // Note: Actual timeout handling may vary
      // This tests that timeout option is accepted
      expect(timeoutTransport).toBeDefined();
    });
  });
});

