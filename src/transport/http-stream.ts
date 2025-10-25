/**
 * HTTP Streaming Transport for MCP
 * Implements HTTP streaming with newline-delimited JSON (NDJSON)
 * Compatible with MCP's StreamableHTTPServer
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

export interface HttpStreamTransportOptions {
  url: string;
  headers?: Record<string, string>;
  /** Timeout for requests in milliseconds */
  timeout?: number;
  /** Heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
}

/**
 * HTTP Streaming Transport
 * Handles bidirectional communication with MCP server via HTTP streaming
 * Uses newline-delimited JSON (NDJSON) over a single persistent connection
 */
export class HttpStreamTransport {
  private url: string;
  private headers: Record<string, string>;
  private timeout: number;
  private heartbeatInterval: number;
  private messageHandlers: Set<MessageHandler> = new Set();
  private pendingRequests: Map<
    string | number,
    {
      resolve: (value: JSONRPCResponse) => void;
      reject: (error: Error) => void;
      timeoutId?: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private streamController?: AbortController;
  private connected = false;
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(options: HttpStreamTransportOptions) {
    this.url = options.url;
    this.headers = options.headers || {};
    this.timeout = options.timeout || 30000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  /**
   * Connect to the MCP server and establish SSE connection
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.streamController = new AbortController();

    try {
      // Establish SSE connection for receiving messages
      const response = await fetch(this.url, {
        method: "GET",
        headers: {
          ...this.headers,
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        signal: this.streamController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      this.connected = true;

      // Process incoming SSE stream
      this.processStream(response.body);

      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Connection was intentionally closed
        return;
      }
      throw error;
    }
  }

  /**
   * Process incoming SSE stream
   */
  private async processStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        // Decode and add to buffer
        buffer += decoder.decode(value, { stream: true });
        
        // Split by newlines
        const lines = buffer.split("\n");
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || "";

        // Process SSE format: "data: {json}\n\n"
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data) {
              this.handleMessage(data);
            }
          } else if (line.trim() === "") {
            // Empty line separates events
            continue;
          } else if (line.startsWith(":")) {
            // SSE comment, ignore
            continue;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Stream was intentionally closed
        return;
      }
      console.error("Stream error:", error);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Start sending periodic heartbeats to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        // Send a ping/heartbeat (you can customize this based on your server's expectations)
        this.sendRawMessage({ jsonrpc: "2.0", method: "ping" }).catch((error) => {
          console.error("Heartbeat failed:", error);
        });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Handle incoming message from server
   */
  private handleMessage(data: string): void {
    try {
      const message = parseMessage(data);

      // Check if this is a response to a pending request
      if ("id" in message && message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          if (pending.timeoutId) {
            clearTimeout(pending.timeoutId);
          }
          this.pendingRequests.delete(message.id);
          pending.resolve(message as JSONRPCResponse);
          return;
        }
      }

      // Otherwise, notify all message handlers (notifications, etc.)
      this.messageHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("Error in message handler:", error);
        }
      });
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  /**
   * Send a raw message to the server via POST (internal use)
   */
  private async sendRawMessage(message: unknown): Promise<void> {
    // Send each message as a separate POST request
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  /**
   * Send a request to the server
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

    // Create promise for response
    const responsePromise = new Promise<JSONRPCResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        timeoutId,
      });
    });

    // Send request over the stream
    try {
      await this.sendRawMessage(request);
    } catch (error) {
      this.pendingRequests.delete(request.id);
      throw error;
    }

    // Wait for response over the same stream
    const response = await responsePromise;

    if ("error" in response) {
      throw new Error(
        `JSON-RPC Error ${response.error.code}: ${response.error.message}`
      );
    }

    return response.result as T;
  }

  /**
   * Register a message handler for notifications and other messages
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

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Cancel SSE stream connection
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = undefined;
    }

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeoutId }) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(new Error("Connection closed"));
    });
    this.pendingRequests.clear();

    // Clear handlers
    this.messageHandlers.clear();

    this.connected = false;
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

