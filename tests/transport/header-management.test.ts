/**
 * Transport Header Management Tests
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { HttpSessionTransport } from "../../src/transport/http-session.js";

describe("Transport Header Management", () => {
  let transport: HttpSessionTransport;

  beforeEach(() => {
    transport = new HttpSessionTransport({
      url: "https://test.mcp.server.com",
      headers: { "X-Custom": "initial-value" },
    });
  });

  afterEach(async () => {
    await transport.disconnect();
  });

  describe("setHeader", () => {
    test("sets a new header", () => {
      transport.setHeader("X-Session-Token", "test-token");
      
      const headers = transport.getHeaders();
      expect(headers["X-Session-Token"]).toBe("test-token");
    });

    test("overwrites existing header", () => {
      transport.setHeader("X-Custom", "value1");
      expect(transport.getHeaders()["X-Custom"]).toBe("value1");
      
      transport.setHeader("X-Custom", "value2");
      expect(transport.getHeaders()["X-Custom"]).toBe("value2");
    });

    test("preserves other headers", () => {
      transport.setHeader("X-Header-1", "value1");
      transport.setHeader("X-Header-2", "value2");
      
      const headers = transport.getHeaders();
      expect(headers["X-Header-1"]).toBe("value1");
      expect(headers["X-Header-2"]).toBe("value2");
    });

    test("accepts any string key and value", () => {
      transport.setHeader("Authorization", "Bearer token123");
      transport.setHeader("Content-Type", "application/json");
      transport.setHeader("X-Request-ID", "abc-123-def");
      
      const headers = transport.getHeaders();
      expect(headers["Authorization"]).toBe("Bearer token123");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Request-ID"]).toBe("abc-123-def");
    });
  });

  describe("removeHeader", () => {
    test("removes an existing header", () => {
      transport.setHeader("X-Test", "value");
      expect(transport.getHeaders()["X-Test"]).toBe("value");
      
      transport.removeHeader("X-Test");
      expect(transport.getHeaders()["X-Test"]).toBeUndefined();
    });

    test("handles removing non-existent header", () => {
      expect(() => {
        transport.removeHeader("X-NonExistent");
      }).not.toThrow();
    });

    test("preserves other headers when removing one", () => {
      transport.setHeader("X-Header-1", "value1");
      transport.setHeader("X-Header-2", "value2");
      transport.setHeader("X-Header-3", "value3");
      
      transport.removeHeader("X-Header-2");
      
      const headers = transport.getHeaders();
      expect(headers["X-Header-1"]).toBe("value1");
      expect(headers["X-Header-2"]).toBeUndefined();
      expect(headers["X-Header-3"]).toBe("value3");
    });

    test("can remove initial headers", () => {
      expect(transport.getHeaders()["X-Custom"]).toBe("initial-value");
      
      transport.removeHeader("X-Custom");
      expect(transport.getHeaders()["X-Custom"]).toBeUndefined();
    });
  });

  describe("getHeaders", () => {
    test("returns copy of headers object", () => {
      const headers1 = transport.getHeaders();
      const headers2 = transport.getHeaders();
      
      // Should be different objects (copy)
      expect(headers1).not.toBe(headers2);
      
      // But should have same content
      expect(headers1).toEqual(headers2);
    });

    test("returns initial headers", () => {
      const headers = transport.getHeaders();
      expect(headers["X-Custom"]).toBe("initial-value");
    });

    test("includes all set headers", () => {
      transport.setHeader("X-Token", "token123");
      transport.setHeader("X-API-Key", "key456");
      
      const headers = transport.getHeaders();
      expect(headers["X-Custom"]).toBe("initial-value");
      expect(headers["X-Token"]).toBe("token123");
      expect(headers["X-API-Key"]).toBe("key456");
    });

    test("modifying returned object doesn't affect transport", () => {
      const headers = transport.getHeaders();
      headers["X-Modified"] = "modified-value";
      
      const headers2 = transport.getHeaders();
      expect(headers2["X-Modified"]).toBeUndefined();
    });
  });

  describe("Header Lifecycle", () => {
    test("headers persist across multiple operations", () => {
      transport.setHeader("X-Persistent", "value");
      
      expect(transport.getHeaders()["X-Persistent"]).toBe("value");
      
      transport.setHeader("X-Another", "another");
      expect(transport.getHeaders()["X-Persistent"]).toBe("value");
      
      transport.removeHeader("X-Another");
      expect(transport.getHeaders()["X-Persistent"]).toBe("value");
    });

    test("can set, get, and remove session token", () => {
      // Set session token
      const token = "session-token-abc123";
      transport.setHeader("X-Session-Token", token);
      expect(transport.getHeaders()["X-Session-Token"]).toBe(token);
      
      // Update session token
      const newToken = "session-token-xyz789";
      transport.setHeader("X-Session-Token", newToken);
      expect(transport.getHeaders()["X-Session-Token"]).toBe(newToken);
      
      // Remove session token
      transport.removeHeader("X-Session-Token");
      expect(transport.getHeaders()["X-Session-Token"]).toBeUndefined();
    });
  });

  describe("Integration with Constructor", () => {
    test("initial headers are preserved", () => {
      const customTransport = new HttpSessionTransport({
        url: "https://test.server.com",
        headers: {
          "X-Init-1": "value1",
          "X-Init-2": "value2",
        },
      });

      const headers = customTransport.getHeaders();
      expect(headers["X-Init-1"]).toBe("value1");
      expect(headers["X-Init-2"]).toBe("value2");
    });

    test("works with empty initial headers", () => {
      const customTransport = new HttpSessionTransport({
        url: "https://test.server.com",
      });

      expect(() => {
        customTransport.setHeader("X-Test", "value");
        customTransport.getHeaders();
        customTransport.removeHeader("X-Test");
      }).not.toThrow();
    });
  });
});

