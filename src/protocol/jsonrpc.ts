/**
 * JSON-RPC 2.0 Implementation
 */

import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from "./messages.js";

/**
 * Generate a unique request ID
 */
let requestIdCounter = 0;
export function generateRequestId(): number {
  return ++requestIdCounter;
}

/**
 * Create a JSON-RPC request
 */
export function createRequest(
  method: string,
  params?: unknown
): JSONRPCRequest {
  return {
    jsonrpc: "2.0",
    id: generateRequestId(),
    method,
    params: params as Record<string, unknown> | unknown[] | undefined,
  };
}

/**
 * Create a JSON-RPC notification (no response expected)
 */
export function createNotification(
  method: string,
  params?: unknown
): JSONRPCNotification {
  return {
    jsonrpc: "2.0",
    method,
    params: params as Record<string, unknown> | unknown[] | undefined,
  };
}

/**
 * Check if a response is an error
 */
export function isErrorResponse(
  response: JSONRPCResponse
): response is JSONRPCResponse & { error: NonNullable<unknown> } {
  return "error" in response;
}

/**
 * Extract result from a successful response
 */
export function getResult<T>(response: JSONRPCResponse<T>): T {
  if (isErrorResponse(response)) {
    throw new Error(
      `JSON-RPC Error ${response.error.code}: ${response.error.message}`
    );
  }
  return response.result;
}

/**
 * Parse a JSON-RPC message from string
 */
export function parseMessage(message: string): JSONRPCResponse | JSONRPCNotification {
  try {
    return JSON.parse(message);
  } catch (error) {
    throw new Error(`Failed to parse JSON-RPC message: ${error}`);
  }
}

/**
 * Serialize a JSON-RPC message to string
 */
export function serializeMessage(
  message: JSONRPCRequest | JSONRPCNotification
): string {
  return JSON.stringify(message);
}

