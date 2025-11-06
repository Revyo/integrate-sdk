/**
 * Plugin System Tests
 */

import { describe, test, expect } from "bun:test";
import { githubPlugin } from "../../src/plugins/github.js";
import { gmailPlugin } from "../../src/plugins/gmail.js";
import { genericOAuthPlugin, createSimplePlugin } from "../../src/plugins/generic.js";
import { hasOAuthConfig } from "../../src/plugins/types.js";

describe("Plugin System", () => {
  describe("GitHub Plugin", () => {
    test("creates plugin with correct structure", () => {
      const plugin = githubPlugin({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });

      expect(plugin.id).toBe("github");
      expect(plugin.tools).toBeArray();
      expect(plugin.tools.length).toBeGreaterThan(0);
      expect(plugin.oauth).toBeDefined();
    });

    test("includes OAuth configuration", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
        scopes: ["repo", "user", "admin:org"],
      });

      expect(plugin.oauth?.provider).toBe("github");
      expect(plugin.oauth?.clientId).toBe("test-id");
      expect(plugin.oauth?.clientSecret).toBe("test-secret");
      expect(plugin.oauth?.scopes).toEqual(["repo", "user", "admin:org"]);
    });

    test("uses default scopes when not provided", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.oauth?.scopes).toEqual(["repo", "user"]);
    });

    test("includes expected tools", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.tools).toContain("github_create_issue");
      expect(plugin.tools).toContain("github_list_repos");
      expect(plugin.tools).toContain("github_create_pull_request");
    });

    test("has lifecycle hooks defined", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.onInit).toBeDefined();
      expect(plugin.onAfterConnect).toBeDefined();
    });

    test("lifecycle hooks execute successfully", async () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      // Test onInit
      await expect(plugin.onInit?.(null as any)).resolves.toBeUndefined();

      // Test onAfterConnect
      await expect(plugin.onAfterConnect?.(null as any)).resolves.toBeUndefined();
    });
  });

  describe("Gmail Plugin", () => {
    test("creates plugin with correct structure", () => {
      const plugin = gmailPlugin({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });

      expect(plugin.id).toBe("gmail");
      expect(plugin.tools).toBeArray();
      expect(plugin.tools.length).toBeGreaterThan(0);
      expect(plugin.oauth).toBeDefined();
    });

    test("includes OAuth configuration", () => {
      const plugin = gmailPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.oauth?.provider).toBe("gmail");
      expect(plugin.oauth?.clientId).toBe("test-id");
      expect(plugin.oauth?.clientSecret).toBe("test-secret");
    });

    test("includes expected tools", () => {
      const plugin = gmailPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.tools).toContain("gmail_send_message");
      expect(plugin.tools).toContain("gmail_list_messages");
      expect(plugin.tools).toContain("gmail_search_messages");
      expect(plugin.tools).toContain("gmail_get_message");
    });

    test("has lifecycle hooks defined", () => {
      const plugin = gmailPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(plugin.onInit).toBeDefined();
      expect(plugin.onAfterConnect).toBeDefined();
    });

    test("lifecycle hooks execute successfully", async () => {
      const plugin = gmailPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      // Test onInit
      await expect(plugin.onInit?.(null as any)).resolves.toBeUndefined();

      // Test onAfterConnect
      await expect(plugin.onAfterConnect?.(null as any)).resolves.toBeUndefined();
    });
  });

  describe("Generic OAuth Plugin", () => {
    test("creates plugin for server-supported integration", () => {
      const plugin = genericOAuthPlugin({
        id: "slack",
        provider: "slack",
        clientId: "slack-id",
        clientSecret: "slack-secret",
        scopes: ["chat:write", "channels:read"],
        tools: ["slack/sendMessage", "slack/listChannels"],
      });

      expect(plugin.id).toBe("slack");
      expect(plugin.oauth?.provider).toBe("slack");
      expect(plugin.tools).toEqual(["slack/sendMessage", "slack/listChannels"]);
    });

    test("supports additional configuration", () => {
      const additionalConfig = {
        customField: "value",
        apiUrl: "https://api.example.com",
      };

      const plugin = genericOAuthPlugin({
        id: "custom",
        provider: "custom-provider",
        clientId: "id",
        clientSecret: "secret",
        scopes: ["read"],
        tools: ["custom/tool"],
        config: additionalConfig,
      });

      // The entire config is stored in the OAuth config
      expect(plugin.oauth?.config).toEqual({
        id: "custom",
        provider: "custom-provider",
        clientId: "id",
        clientSecret: "secret",
        scopes: ["read"],
        tools: ["custom/tool"],
        config: additionalConfig,
      });
    });
  });

  describe("Simple Plugin", () => {
    test("creates plugin without OAuth", () => {
      const plugin = createSimplePlugin({
        id: "math",
        tools: ["math/add", "math/subtract"],
      });

      expect(plugin.id).toBe("math");
      expect(plugin.tools).toEqual(["math/add", "math/subtract"]);
      expect(plugin.oauth).toBeUndefined();
    });

    test("supports lifecycle hooks", () => {
      let initCalled = false;
      let connectCalled = false;

      const plugin = createSimplePlugin({
        id: "test",
        tools: ["test/tool"],
        onInit: () => {
          initCalled = true;
        },
        onAfterConnect: () => {
          connectCalled = true;
        },
      });

      expect(plugin.onInit).toBeDefined();
      expect(plugin.onAfterConnect).toBeDefined();

      plugin.onInit?.(null as any);
      plugin.onAfterConnect?.(null as any);

      expect(initCalled).toBe(true);
      expect(connectCalled).toBe(true);
    });
  });

  describe("hasOAuthConfig type guard", () => {
    test("returns true for plugin with OAuth", () => {
      const plugin = githubPlugin({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(hasOAuthConfig(plugin)).toBe(true);
    });

    test("returns false for plugin without OAuth", () => {
      const plugin = createSimplePlugin({
        id: "test",
        tools: ["test/tool"],
      });

      expect(hasOAuthConfig(plugin)).toBe(false);
    });
  });
});

