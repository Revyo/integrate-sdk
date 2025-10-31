/**
 * Error Types Tests
 * Comprehensive tests for all error classes
 */

import { describe, test, expect } from "bun:test";
import {
  IntegrateSDKError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  ConnectionError,
  ToolCallError,
  isAuthError,
  isTokenExpiredError,
  isAuthorizationError,
  parseServerError,
} from "../../src/errors.js";

describe("Error Types", () => {
  describe("IntegrateSDKError", () => {
    test("creates base error", () => {
      const error = new IntegrateSDKError("Test error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("IntegrateSDKError");
    });
  });

  describe("AuthenticationError", () => {
    test("creates auth error with all params", () => {
      const error = new AuthenticationError("Auth failed", 401, "github");
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Auth failed");
      expect(error.statusCode).toBe(401);
      expect(error.provider).toBe("github");
      expect(error.name).toBe("AuthenticationError");
    });

    test("creates auth error without optional params", () => {
      const error = new AuthenticationError("Auth failed");
      expect(error.message).toBe("Auth failed");
      expect(error.statusCode).toBeUndefined();
      expect(error.provider).toBeUndefined();
    });
  });

  describe("AuthorizationError", () => {
    test("creates authorization error with all params", () => {
      const error = new AuthorizationError("Forbidden", 403, ["repo", "user"]);
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBe(403);
      expect(error.requiredScopes).toEqual(["repo", "user"]);
      expect(error.name).toBe("AuthorizationError");
    });

    test("creates authorization error without optional params", () => {
      const error = new AuthorizationError("Forbidden");
      expect(error.message).toBe("Forbidden");
      expect(error.statusCode).toBeUndefined();
      expect(error.requiredScopes).toBeUndefined();
    });
  });

  describe("TokenExpiredError", () => {
    test("creates token expired error", () => {
      const error = new TokenExpiredError("Token expired", "github");
      expect(error).toBeInstanceOf(TokenExpiredError);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Token expired");
      expect(error.statusCode).toBe(401);
      expect(error.provider).toBe("github");
      expect(error.name).toBe("TokenExpiredError");
    });

    test("creates token expired error without provider", () => {
      const error = new TokenExpiredError("Token expired");
      expect(error.message).toBe("Token expired");
      expect(error.provider).toBeUndefined();
    });
  });

  describe("ConnectionError", () => {
    test("creates connection error with status code", () => {
      const error = new ConnectionError("Connection failed", 500);
      expect(error).toBeInstanceOf(ConnectionError);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Connection failed");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("ConnectionError");
    });

    test("creates connection error without status code", () => {
      const error = new ConnectionError("Connection failed");
      expect(error.message).toBe("Connection failed");
      expect(error.statusCode).toBeUndefined();
    });
  });

  describe("ToolCallError", () => {
    test("creates tool call error with original error", () => {
      const originalError = new Error("Original");
      const error = new ToolCallError(
        "Tool failed",
        "github_get_repo",
        originalError
      );
      expect(error).toBeInstanceOf(ToolCallError);
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("Tool failed");
      expect(error.toolName).toBe("github_get_repo");
      expect(error.originalError).toBe(originalError);
      expect(error.name).toBe("ToolCallError");
    });

    test("creates tool call error without original error", () => {
      const error = new ToolCallError("Tool failed", "github_get_repo");
      expect(error.message).toBe("Tool failed");
      expect(error.toolName).toBe("github_get_repo");
      expect(error.originalError).toBeUndefined();
    });
  });

  describe("Type guards", () => {
    test("isAuthError identifies auth errors", () => {
      const authError = new AuthenticationError("Auth failed");
      const tokenError = new TokenExpiredError("Token expired");
      const otherError = new Error("Generic");

      expect(isAuthError(authError)).toBe(true);
      expect(isAuthError(tokenError)).toBe(true);
      expect(isAuthError(otherError)).toBe(false);
    });

    test("isTokenExpiredError identifies token errors", () => {
      const tokenError = new TokenExpiredError("Token expired");
      const authError = new AuthenticationError("Auth failed");
      const otherError = new Error("Generic");

      expect(isTokenExpiredError(tokenError)).toBe(true);
      expect(isTokenExpiredError(authError)).toBe(false);
      expect(isTokenExpiredError(otherError)).toBe(false);
    });

    test("isAuthorizationError identifies authorization errors", () => {
      const authzError = new AuthorizationError("Forbidden");
      const authError = new AuthenticationError("Auth failed");
      const otherError = new Error("Generic");

      expect(isAuthorizationError(authzError)).toBe(true);
      expect(isAuthorizationError(authError)).toBe(false);
      expect(isAuthorizationError(otherError)).toBe(false);
    });
  });

  describe("parseServerError", () => {
    test("parses JSON-RPC invalid request error", () => {
      const error = parseServerError({ code: -32600, message: "Invalid request" });
      expect(error.message).toContain("Invalid request");
    });

    test("parses JSON-RPC method not found error", () => {
      const error = parseServerError({ code: -32601, message: "Method not found" });
      expect(error.message).toContain("Method not found");
    });

    test("parses JSON-RPC invalid params error", () => {
      const error = parseServerError({ code: -32602, message: "Invalid params" });
      expect(error.message).toContain("Invalid params");
    });

    test("parses 403 authorization error", () => {
      const error = parseServerError({ code: 403, message: "Forbidden" });
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe("Forbidden");
    });

    test("parses -32002 authorization error", () => {
      const error = parseServerError({ code: -32002, message: "Forbidden" });
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    test("parses error with jsonrpcError property", () => {
      const error = parseServerError({
        message: "Wrapper error",
        jsonrpcError: {
          code: 401,
          message: "Unauthorized",
        },
      });
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe("Unauthorized");
    });

    test("parses Error object with 401 statusCode", () => {
      const err = new Error("Unauthorized");
      (err as any).statusCode = 401;
      const error = parseServerError(err, { provider: "github" });
      expect(error).toBeInstanceOf(AuthenticationError);
      expect((error as AuthenticationError).provider).toBe("github");
    });

    test("parses Error object with 403 statusCode", () => {
      const err = new Error("Forbidden");
      (err as any).statusCode = 403;
      const error = parseServerError(err);
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    test("parses Error with 401 in message", () => {
      const err = new Error("401 Unauthorized");
      const error = parseServerError(err);
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    test("parses Error with 'Unauthorized' in message", () => {
      const err = new Error("Request Unauthorized");
      const error = parseServerError(err, { provider: "github" });
      expect(error).toBeInstanceOf(AuthenticationError);
    });

    test("parses Error with 403 in message", () => {
      const err = new Error("403 Forbidden");
      const error = parseServerError(err);
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    test("parses Error with 'Forbidden' in message", () => {
      const err = new Error("Access Forbidden");
      const error = parseServerError(err);
      expect(error).toBeInstanceOf(AuthorizationError);
    });

    test("creates ToolCallError when toolName is provided", () => {
      const err = new Error("Tool failed");
      const error = parseServerError(err, { toolName: "github_get_repo" });
      expect(error).toBeInstanceOf(ToolCallError);
      expect((error as ToolCallError).toolName).toBe("github_get_repo");
    });

    test("handles non-object errors", () => {
      const error = parseServerError("string error");
      expect(error).toBeInstanceOf(IntegrateSDKError);
      expect(error.message).toBe("string error");
    });

    test("handles null error", () => {
      const error = parseServerError(null);
      expect(error).toBeInstanceOf(IntegrateSDKError);
    });
  });
});

