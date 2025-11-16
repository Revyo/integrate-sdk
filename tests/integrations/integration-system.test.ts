/**
 * Integration System Tests
 */

import { describe, test, expect } from "bun:test";
import { githubIntegration } from "../../src/integrations/github.js";
import { gmailIntegration } from "../../src/integrations/gmail.js";
import { genericOAuthIntegration, createSimpleIntegration } from "../../src/integrations/generic.js";
import { hasOAuthConfig } from "../../src/integrations/types.js";

describe("Integration System", () => {
  describe("GitHub Integration", () => {
    test("creates integration with correct structure", () => {
      const integration = githubIntegration({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });

      expect(integration.id).toBe("github");
      expect(integration.tools).toBeArray();
      expect(integration.tools.length).toBeGreaterThan(0);
      expect(integration.oauth).toBeDefined();
    });

    test("includes OAuth configuration", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
        scopes: ["repo", "user", "admin:org"],
      });

      expect(integration.oauth?.provider).toBe("github");
      expect(integration.oauth?.clientId).toBe("test-id");
      expect(integration.oauth?.clientSecret).toBe("test-secret");
      expect(integration.oauth?.scopes).toEqual(["repo", "user", "admin:org"]);
    });

    test("uses default scopes when not provided", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.oauth?.scopes).toEqual(["repo", "user"]);
    });

    test("includes expected tools", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.tools).toContain("github_create_issue");
      expect(integration.tools).toContain("github_list_repos");
      expect(integration.tools).toContain("github_create_pull_request");
    });

    test("has lifecycle hooks defined", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.onInit).toBeDefined();
      expect(integration.onAfterConnect).toBeDefined();
    });

    test("lifecycle hooks execute successfully", async () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      // Test onInit
      await expect(integration.onInit?.(null as any)).resolves.toBeUndefined();

      // Test onAfterConnect
      await expect(integration.onAfterConnect?.(null as any)).resolves.toBeUndefined();
    });
  });

  describe("Gmail Integration", () => {
    test("creates integration with correct structure", () => {
      const integration = gmailIntegration({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });

      expect(integration.id).toBe("gmail");
      expect(integration.tools).toBeArray();
      expect(integration.tools.length).toBeGreaterThan(0);
      expect(integration.oauth).toBeDefined();
    });

    test("includes OAuth configuration", () => {
      const integration = gmailIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.oauth?.provider).toBe("gmail");
      expect(integration.oauth?.clientId).toBe("test-id");
      expect(integration.oauth?.clientSecret).toBe("test-secret");
    });

    test("includes expected tools", () => {
      const integration = gmailIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.tools).toContain("gmail_send_message");
      expect(integration.tools).toContain("gmail_list_messages");
      expect(integration.tools).toContain("gmail_search_messages");
      expect(integration.tools).toContain("gmail_get_message");
    });

    test("has lifecycle hooks defined", () => {
      const integration = gmailIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(integration.onInit).toBeDefined();
      expect(integration.onAfterConnect).toBeDefined();
    });

    test("lifecycle hooks execute successfully", async () => {
      const integration = gmailIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      // Test onInit
      await expect(integration.onInit?.(null as any)).resolves.toBeUndefined();

      // Test onAfterConnect
      await expect(integration.onAfterConnect?.(null as any)).resolves.toBeUndefined();
    });
  });

  describe("Generic OAuth Integration", () => {
    test("creates integration for server-supported integration", () => {
      const integration = genericOAuthIntegration({
        id: "slack",
        provider: "slack",
        clientId: "slack-id",
        clientSecret: "slack-secret",
        scopes: ["chat:write", "channels:read"],
        tools: ["slack/sendMessage", "slack/listChannels"],
      });

      expect(integration.id).toBe("slack");
      expect(integration.oauth?.provider).toBe("slack");
      expect(integration.tools).toEqual(["slack/sendMessage", "slack/listChannels"]);
    });

    test("supports additional configuration", () => {
      const additionalConfig = {
        customField: "value",
        apiUrl: "https://api.example.com",
      };

      const integration = genericOAuthIntegration({
        id: "custom",
        provider: "custom-provider",
        clientId: "id",
        clientSecret: "secret",
        scopes: ["read"],
        tools: ["custom/tool"],
        config: additionalConfig,
      });

      // The entire config is stored in the OAuth config
      expect(integration.oauth?.config).toEqual({
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

  describe("Simple Integration", () => {
    test("creates integration without OAuth", () => {
      const integration = createSimpleIntegration({
        id: "math",
        tools: ["math/add", "math/subtract"],
      });

      expect(integration.id).toBe("math");
      expect(integration.tools).toEqual(["math/add", "math/subtract"]);
      expect(integration.oauth).toBeUndefined();
    });

    test("supports lifecycle hooks", () => {
      let initCalled = false;
      let connectCalled = false;

      const integration = createSimpleIntegration({
        id: "test",
        tools: ["test/tool"],
        onInit: () => {
          initCalled = true;
        },
        onAfterConnect: () => {
          connectCalled = true;
        },
      });

      expect(integration.onInit).toBeDefined();
      expect(integration.onAfterConnect).toBeDefined();

      integration.onInit?.(null as any);
      integration.onAfterConnect?.(null as any);

      expect(initCalled).toBe(true);
      expect(connectCalled).toBe(true);
    });
  });

  describe("hasOAuthConfig type guard", () => {
    test("returns true for integration with OAuth", () => {
      const integration = githubIntegration({
        clientId: "test-id",
        clientSecret: "test-secret",
      });

      expect(hasOAuthConfig(integration)).toBe(true);
    });

    test("returns false for integration without OAuth", () => {
      const integration = createSimpleIntegration({
        id: "test",
        tools: ["test/tool"],
      });

      expect(hasOAuthConfig(integration)).toBe(false);
    });
  });
});

