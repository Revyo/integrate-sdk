/**
 * Server Namespace Tests
 * Tests for the new client.server.* typed API
 */

import { describe, test, expect } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { githubPlugin } from "../../src/plugins/github.js";

describe("Server Namespace", () => {
  test("server namespace is always available", () => {
    const client = createMCPClient({
      plugins: [
        githubPlugin({
          clientId: "test-id",
          clientSecret: "test-secret",
        }),
      ],
    });

    expect(client.server).toBeDefined();
    expect(typeof client.server.listToolsByIntegration).toBe("function");
  });

  test("server methods throw when not initialized", async () => {
    const client = createMCPClient({
      plugins: [
        githubPlugin({
          clientId: "test-id",
          clientSecret: "test-secret",
        }),
      ],
    });

    await expect(
      client.server.listToolsByIntegration({ integration: "github" })
    ).rejects.toThrow("Client not initialized");
  });

  test("callServerTool method exists and throws when not initialized", async () => {
    const client = createMCPClient({
      plugins: [
        githubPlugin({
          clientId: "test-id",
          clientSecret: "test-secret",
        }),
      ],
    });

    await expect(
      client.callServerTool("list_tools_by_integration", {
        integration: "github",
      })
    ).rejects.toThrow("Client not initialized");
  });
});

