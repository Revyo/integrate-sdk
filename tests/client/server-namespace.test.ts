/**
 * Server Namespace Tests
 * Tests for the new client.server.* typed API
 */

import { describe, test, expect, mock } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubIntegration } from "../../src/integrations/github.js";

describe("Server Namespace", () => {
  test("server namespace is always available", () => {
    const client = createMCPClient({
      integrations: [
        githubIntegration({
          clientId: "test-id",
          clientSecret: "test-secret",
        }),
      ],
    });

    expect(client.server).toBeDefined();
    expect(typeof client.server.listToolsByIntegration).toBe("function");
  });

  test("server methods work through API handler without initialization", async () => {
    const mockFetch = mock(async (url: string) => {
      if (url.includes("/api/integrate/mcp")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: "text", text: "server tools result" }],
          }),
          headers: new Headers(),
        } as Response;
      }
      return { ok: false } as Response;
    }) as any;

    global.fetch = mockFetch;

    const client = createMCPClient({
      integrations: [
        githubIntegration({
          clientId: "test-id",
        }),
      ],
      connectionMode: 'manual',  // Manual mode - no auto-connect
      singleton: false,
    });

    // Should work through API handler without calling connect()
    const result = await client.server.listToolsByIntegration({ integration: "github" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("server tools result");
  });

  test("callServerTool method works through API handler without initialization", async () => {
    const mockFetch = mock(async (url: string) => {
      if (url.includes("/api/integrate/mcp")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ type: "text", text: "server tools via callServerTool" }],
          }),
          headers: new Headers(),
        } as Response;
      }
      return { ok: false } as Response;
    }) as any;

    global.fetch = mockFetch;

    const client = createMCPClient({
      integrations: [
        githubIntegration({
          clientId: "test-id",
        }),
      ],
      connectionMode: 'manual',  // Manual mode - no auto-connect
      singleton: false,
    });

    // Should work through API handler without calling connect()
    const result = await client.callServerTool("list_tools_by_integration", {
      integration: "github",
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toBe("server tools via callServerTool");
  });
});

