/**
 * Custom error types for the Integrate SDK
 */

/**
 * Base error class for all SDK errors
 */
export class IntegrateSDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrateSDKError";
  }
}

/**
 * Error thrown when authentication fails or tokens are invalid
 */
export class AuthenticationError extends IntegrateSDKError {
  public readonly statusCode?: number;
  public readonly provider?: string;

  constructor(message: string, statusCode?: number, provider?: string) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

/**
 * Error thrown when access is forbidden (insufficient permissions)
 */
export class AuthorizationError extends IntegrateSDKError {
  public readonly statusCode?: number;
  public readonly requiredScopes?: string[];

  constructor(message: string, statusCode?: number, requiredScopes?: string[]) {
    super(message);
    this.name = "AuthorizationError";
    this.statusCode = statusCode;
    this.requiredScopes = requiredScopes;
  }
}

/**
 * Error thrown when OAuth tokens have expired and need to be refreshed
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(message: string, provider?: string) {
    super(message, 401, provider);
    this.name = "TokenExpiredError";
  }
}

/**
 * Error thrown when a connection to the server fails
 */
export class ConnectionError extends IntegrateSDKError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ConnectionError";
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when a tool call fails
 */
export class ToolCallError extends IntegrateSDKError {
  public readonly toolName: string;
  public readonly originalError?: unknown;

  constructor(message: string, toolName: string, originalError?: unknown) {
    super(message);
    this.name = "ToolCallError";
    this.toolName = toolName;
    this.originalError = originalError;
  }
}

/**
 * Helper function to determine if an error is an authentication error
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Helper function to determine if an error is a token expired error
 */
export function isTokenExpiredError(error: unknown): error is TokenExpiredError {
  return error instanceof TokenExpiredError;
}

/**
 * Helper function to determine if an error is an authorization error
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Helper function to parse error responses from the MCP server
 * and convert them to appropriate error types
 */
export function parseServerError(
  error: any,
  context?: { toolName?: string; provider?: string }
): IntegrateSDKError {
  // Check if the error has an attached JSON-RPC error (from transport layer)
  if (error && typeof error === "object" && "jsonrpcError" in error) {
    const jsonrpcError = error.jsonrpcError;
    if (jsonrpcError && typeof jsonrpcError === "object") {
      return parseServerError(jsonrpcError, context);
    }
  }

  // Check for JSON-RPC error format
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const code = error.code;
    const message = error.message || "Unknown error";

    // Standard JSON-RPC error codes
    if (code === -32600) {
      return new IntegrateSDKError(`Invalid request: ${message}`);
    }
    if (code === -32601) {
      return new IntegrateSDKError(`Method not found: ${message}`);
    }
    if (code === -32602) {
      return new IntegrateSDKError(`Invalid params: ${message}`);
    }

    // Custom authentication error codes
    if (code === 401 || code === -32001) {
      // Check if it's a token expiry
      if (
        message.toLowerCase().includes("expired") ||
        message.toLowerCase().includes("token")
      ) {
        return new TokenExpiredError(message, context?.provider);
      }
      return new AuthenticationError(message, 401, context?.provider);
    }

    // Authorization errors
    if (code === 403 || code === -32002) {
      return new AuthorizationError(message, 403);
    }

    // Tool-specific errors
    if (context?.toolName) {
      return new ToolCallError(message, context.toolName, error);
    }

    return new IntegrateSDKError(message);
  }

  // Handle regular Error objects
  if (error instanceof Error) {
    const message = error.message;
    
    // Check for HTTP status code attached to error
    const statusCode = (error as any).statusCode;
    if (statusCode === 401) {
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("token")) {
        return new TokenExpiredError(message, context?.provider);
      }
      return new AuthenticationError(message, 401, context?.provider);
    }
    if (statusCode === 403) {
      return new AuthorizationError(message, 403);
    }

    // Check for common auth error patterns in message
    if (
      message.includes("401") ||
      message.includes("Unauthorized") ||
      message.includes("unauthenticated")
    ) {
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("token")) {
        return new TokenExpiredError(message, context?.provider);
      }
      return new AuthenticationError(message, 401, context?.provider);
    }

    if (
      message.includes("403") ||
      message.includes("Forbidden") ||
      message.includes("unauthorized")
    ) {
      return new AuthorizationError(message, 403);
    }

    if (context?.toolName) {
      return new ToolCallError(message, context.toolName, error);
    }

    return new IntegrateSDKError(message);
  }

  // Fallback
  return new IntegrateSDKError(String(error));
}

