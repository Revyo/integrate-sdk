/**
 * JSON-RPC Protocol Tests
 */

import { describe, test, expect } from "bun:test";
import {
  createRequest,
  createNotification,
  isErrorResponse,
  getResult,
  parseMessage,
  serializeMessage,
} from "../../src/protocol/jsonrpc.js";

describe("JSON-RPC Protocol", () => {
  describe("createRequest", () => {
    test("creates valid JSON-RPC request", () => {
      const request = createRequest("test/method", { param: "value" });
      
      expect(request.jsonrpc).toBe("2.0");
      expect(request.method).toBe("test/method");
      expect(request.params).toEqual({ param: "value" });
      expect(typeof request.id).toBe("number");
    });

    test("creates request without params", () => {
      const request = createRequest("test/method");
      
      expect(request.jsonrpc).toBe("2.0");
      expect(request.method).toBe("test/method");
      expect(request.params).toBeUndefined();
    });

    test("generates unique IDs", () => {
      const req1 = createRequest("method1");
      const req2 = createRequest("method2");
      
      expect(req1.id).not.toBe(req2.id);
    });
  });

  describe("createNotification", () => {
    test("creates valid JSON-RPC notification", () => {
      const notification = createNotification("test/notification", { data: 123 });
      
      expect(notification.jsonrpc).toBe("2.0");
      expect(notification.method).toBe("test/notification");
      expect(notification.params).toEqual({ data: 123 });
      expect(notification).not.toHaveProperty("id");
    });
  });

  describe("isErrorResponse", () => {
    test("identifies error response", () => {
      const errorResponse = {
        jsonrpc: "2.0" as const,
        id: 1,
        error: {
          code: -32600,
          message: "Invalid Request",
        },
      };
      
      expect(isErrorResponse(errorResponse)).toBe(true);
    });

    test("identifies success response", () => {
      const successResponse = {
        jsonrpc: "2.0" as const,
        id: 1,
        result: { success: true },
      };
      
      expect(isErrorResponse(successResponse)).toBe(false);
    });
  });

  describe("getResult", () => {
    test("extracts result from success response", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: 1,
        result: { data: "test" },
      };
      
      const result = getResult(response);
      expect(result).toEqual({ data: "test" });
    });

    test("throws error for error response", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: 1,
        error: {
          code: -32600,
          message: "Invalid Request",
        },
      };
      
      expect(() => getResult(response)).toThrow("Invalid Request");
    });
  });

  describe("parseMessage", () => {
    test("parses valid JSON message", () => {
      const json = '{"jsonrpc":"2.0","id":1,"result":{"success":true}}';
      const message = parseMessage(json);
      
      expect(message).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: { success: true },
      });
    });

    test("throws error for invalid JSON", () => {
      expect(() => parseMessage("invalid json")).toThrow();
    });
  });

  describe("serializeMessage", () => {
    test("serializes request to JSON", () => {
      const request = createRequest("test/method", { param: "value" });
      const json = serializeMessage(request);
      
      expect(json).toContain('"jsonrpc":"2.0"');
      expect(json).toContain('"method":"test/method"');
      expect(json).toContain('"param":"value"');
    });

    test("produces valid JSON", () => {
      const request = createRequest("test");
      const json = serializeMessage(request);
      
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});

