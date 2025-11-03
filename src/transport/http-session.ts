/**
 * HTTP Session-Based Transport for MCP
 * Uses POST for request/response and optional SSE for notifications
 * Compatible with MCP StreamableHTTPServer with sessions
 */

import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from "../protocol/messages.js";
import { parseMessage } from "../protocol/jsonrpc.js";

export type MessageHandler = (
  message: JSONRPCResponse | JSONRPCNotification
) => void;

export interface HttpSessionTransportOptions {
  url: string;
  headers?: Record<string, string>;
  /** Timeout for requests in milliseconds */
  timeout?: number;
}

/**
 * HTTP Session Transport
 * Maintains a session with the MCP server
 * - Sends requests via POST
 * - Receives responses in POST response body
 * - Optionally listens for notifications via SSE
 */
export class HttpSessionTransport {
  private url: string;
  private headers: Record<string, string>;
  private timeout: number;
  private messageHandlers: Set<MessageHandler> = new Set();
  private sessionId?: string;
  private sseController?: AbortController;
  private connected = false;

  constructor(options: HttpSessionTransportOptions) {
    this.url = options.url;
    this.headers = options.headers || {};
    this.timeout = options.timeout || 30000;
  }

  /**
   * Initialize session (no persistent connection needed)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Session will be established on first request
    this.connected = true;
  }

  /**
   * Send a request to the server and get immediate response
   */
  async sendRequest<T = unknown>(
    method: string,
    params?: unknown
  ): Promise<T> {
    if (!this.connected) {
      throw new Error("Not connected to server");
    }

    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: Date.now() + Math.random(),
      method,
      params: params as Record<string, unknown> | unknown[] | undefined,
    };

    const headers: Record<string, string> = {
      ...this.headers,
      "Content-Type": "application/json",
    };

    // Include session ID if we have one
    if (this.sessionId) {
      headers["mcp-session-id"] = this.sessionId;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Preserve HTTP status code for auth error detection
        const error = new Error(`Request failed: ${response.statusText}`) as Error & { statusCode?: number };
        error.statusCode = response.status;
        throw error;
      }

      // Capture session ID from first response
      if (!this.sessionId) {
        const sid = response.headers.get("mcp-session-id");
        if (sid) {
          this.sessionId = sid;
          console.log("Session established:", sid);
          
          // Start SSE listener for notifications
          this.startSSEListener();
        }
      }

      const jsonResponse = (await response.json()) as JSONRPCResponse<T>;

      if ("error" in jsonResponse) {
        // Preserve the full error object for the client to parse
        const error = new Error(
          `JSON-RPC Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`
        ) as Error & { code?: number; data?: unknown };
        error.code = jsonResponse.error.code;
        if (jsonResponse.error.data) {
          error.data = jsonResponse.error.data;
        }
        // Attach the original JSON-RPC error for detailed parsing
        (error as any).jsonrpcError = jsonResponse.error;
        throw error;
      }

      return jsonResponse.result as T;
    } catch (error) {
      // If it's a fetch error (network, timeout, etc.), wrap it appropriately
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          const timeoutError = new Error("Request timeout") as Error & { code?: number };
          timeoutError.code = -32000; // Custom timeout code
          throw timeoutError;
        }
        // Re-throw errors with preserved information
        throw error;
      }
      throw new Error(String(error));
    }
  }

  /**
   * Start SSE listener for server-initiated notifications
   */
  private async startSSEListener(): Promise<void> {
    if (!this.sessionId || this.sseController) {
      return;
    }

    this.sseController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: "GET",
        headers: {
          ...this.headers,
          "Accept": "text/event-stream",
          "mcp-session-id": this.sessionId,
        },
        signal: this.sseController.signal,
      });

      if (!response.ok || !response.body) {
        return;
      }

      // Process SSE stream for notifications
      this.processSSEStream(response.body);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Connection was intentionally closed
        return;
      }
      console.error("SSE connection error:", error);
    }
  }

  /**
   * Process SSE stream for server notifications
   */
  private async processSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data) {
              this.handleNotification(data);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("SSE stream error:", error);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Handle incoming notification from SSE
   */
  private handleNotification(data: string): void {
    try {
      const message = parseMessage(data);
      
      // Notify all message handlers
      this.messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("Error in message handler:", error);
        }
      });
    } catch (error) {
      console.error("Failed to parse notification:", error);
    }
  }

  /**
   * Register a message handler for notifications
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Close SSE connection if open
    if (this.sseController) {
      this.sseController.abort();
      this.sseController = undefined;
    }

    // Clear handlers
    this.messageHandlers.clear();

    this.sessionId = undefined;
    this.connected = false;
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Set a custom header for all requests
   * Used for session tokens and other auth headers
   * 
   * @param key - Header name
   * @param value - Header value
   * 
   * @example
   * ```typescript
   * transport.setHeader('X-Session-Token', 'abc123');
   * ```
   */
  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  /**
   * Remove a custom header
   * 
   * @param key - Header name to remove
   */
  removeHeader(key: string): void {
    delete this.headers[key];
  }

  /**
   * Get all current headers
   */
  getHeaders(): Record<string, string> {
    return { ...this.headers };
  }
}

