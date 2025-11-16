/**
 * Naming Utilities Tests
 */

import { describe, test, expect } from "bun:test";
import {
  camelToSnake,
  snakeToCamel,
  methodToToolName,
  toolNameToMethod,
} from "../../src/utils/naming.js";

describe("Naming Utilities", () => {
  describe("camelToSnake", () => {
    test("converts camelCase to snake_case", () => {
      expect(camelToSnake("getRepo")).toBe("get_repo");
      expect(camelToSnake("listOwnRepos")).toBe("list_own_repos");
      expect(camelToSnake("searchCode")).toBe("search_code");
    });

    test("handles single word names", () => {
      expect(camelToSnake("search")).toBe("search");
      expect(camelToSnake("list")).toBe("list");
      expect(camelToSnake("get")).toBe("get");
    });

    test("handles already lowercase names", () => {
      expect(camelToSnake("lowercase")).toBe("lowercase");
    });

    test("handles empty string", () => {
      expect(camelToSnake("")).toBe("");
    });

    test("handles multiple consecutive capitals", () => {
      expect(camelToSnake("getUserID")).toBe("get_user_i_d");
      expect(camelToSnake("XMLParser")).toBe("_x_m_l_parser");
    });

    test("handles names starting with capital", () => {
      expect(camelToSnake("GetRepo")).toBe("_get_repo");
    });
  });

  describe("snakeToCamel", () => {
    test("converts snake_case to camelCase", () => {
      expect(snakeToCamel("get_repo")).toBe("getRepo");
      expect(snakeToCamel("list_own_repos")).toBe("listOwnRepos");
      expect(snakeToCamel("search_code")).toBe("searchCode");
    });

    test("handles single word names", () => {
      expect(snakeToCamel("search")).toBe("search");
      expect(snakeToCamel("list")).toBe("list");
      expect(snakeToCamel("get")).toBe("get");
    });

    test("handles already camelCase names", () => {
      expect(snakeToCamel("camelCase")).toBe("camelCase");
    });

    test("handles empty string", () => {
      expect(snakeToCamel("")).toBe("");
    });

    test("handles multiple underscores", () => {
      expect(snakeToCamel("get_user_profile_data")).toBe("getUserProfileData");
    });

    test("handles names starting with underscore", () => {
      expect(snakeToCamel("_private_method")).toBe("PrivateMethod");
    });
  });

  describe("methodToToolName", () => {
    test("converts method name to tool name with integration prefix", () => {
      expect(methodToToolName("getRepo", "github")).toBe("github_get_repo");
      expect(methodToToolName("sendEmail", "gmail")).toBe("gmail_send_email");
    });

    test("handles already snake_case method names", () => {
      expect(methodToToolName("get_repo", "github")).toBe("github_get_repo");
    });

    test("handles single word method names", () => {
      expect(methodToToolName("search", "github")).toBe("github_search");
    });

    test("handles multiple words in method name", () => {
      expect(methodToToolName("getUserProfile", "github")).toBe("github_get_user_profile");
    });

    test("handles different integration IDs", () => {
      expect(methodToToolName("getRepo", "github")).toBe("github_get_repo");
      expect(methodToToolName("getRepo", "gitlab")).toBe("gitlab_get_repo");
      expect(methodToToolName("getRepo", "bitbucket")).toBe("bitbucket_get_repo");
    });
  });

  describe("toolNameToMethod", () => {
    test("converts tool name to method name", () => {
      expect(toolNameToMethod("github_get_repo")).toBe("getRepo");
      expect(toolNameToMethod("gmail_send_email")).toBe("sendEmail");
    });

    test("removes integration prefix correctly", () => {
      expect(toolNameToMethod("github_list_repos")).toBe("listRepos");
      expect(toolNameToMethod("gitlab_get_project")).toBe("getProject");
    });

    test("handles multi-word method names", () => {
      expect(toolNameToMethod("github_get_user_profile")).toBe("getUserProfile");
      expect(toolNameToMethod("gmail_send_email_message")).toBe("sendEmailMessage");
    });

    test("handles single word method names", () => {
      expect(toolNameToMethod("github_search")).toBe("search");
    });
  });

  describe("Round Trip Conversions", () => {
    test("camelToSnake and snakeToCamel are inverse operations", () => {
      const original = "getUserProfile";
      expect(snakeToCamel(camelToSnake(original))).toBe(original);
    });

    test("methodToToolName and toolNameToMethod are inverse operations", () => {
      const methodName = "getRepo";
      const integrationId = "github";
      const toolName = methodToToolName(methodName, integrationId);
      expect(toolNameToMethod(toolName)).toBe(methodName);
    });

    test("handles real-world method names", () => {
      const methods = ["getRepo", "listRepos", "createIssue", "updatePullRequest"];

      for (const method of methods) {
        const toolName = methodToToolName(method, "github");
        expect(toolNameToMethod(toolName)).toBe(method);
      }
    });
  });

  describe("Integration with Integration System", () => {
    test("generates correct tool names for GitHub integration", () => {
      expect(methodToToolName("getRepo", "github")).toBe("github_get_repo");
      expect(methodToToolName("listRepos", "github")).toBe("github_list_repos");
      expect(methodToToolName("createIssue", "github")).toBe("github_create_issue");
    });

    test("generates correct tool names for Gmail integration", () => {
      expect(methodToToolName("sendEmail", "gmail")).toBe("gmail_send_email");
      expect(methodToToolName("listEmails", "gmail")).toBe("gmail_list_emails");
      expect(methodToToolName("getMessage", "gmail")).toBe("gmail_get_message");
    });

    test("converts tool names back to methods correctly", () => {
      expect(toolNameToMethod("github_get_repo")).toBe("getRepo");
      expect(toolNameToMethod("github_list_repos")).toBe("listRepos");
      expect(toolNameToMethod("gmail_send_email")).toBe("sendEmail");
    });
  });
});

