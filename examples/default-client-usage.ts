/**
 * Default Client Usage Example
 *
 * This example demonstrates the simplest way to use the SDK:
 * Just import the default client and start using it!
 */

// Import the default pre-configured client
import { client } from "../index.js";

async function main() {
  console.log("=== Default Client Usage Example ===\n");

  // The default client comes with GitHub and Gmail integrations pre-configured
  // No need to create a client or configure integrations!

  try {
    // Example: Get a GitHub repository
    console.log("--- GitHub Example ---");
    const repo = await client.github.getRepo({
      owner: "facebook",
      repo: "react",
    });
    console.log("Repository:", JSON.stringify(repo, null, 2).substring(0, 500));

    // Example: List your own GitHub repositories
    console.log("\n--- List Own Repos ---");
    const repos = await client.github.listOwnRepos({});
    console.log("Your repositories:", JSON.stringify(repos, null, 2).substring(0, 500));

    // Example: Send an email with Gmail
    console.log("\n--- Gmail Example ---");
    const result = await client.gmail.sendMessage({
      to: "example@example.com",
      subject: "Test Email",
      body: "This is a test email sent via MCP",
    });
    console.log("Email sent:", JSON.stringify(result, null, 2).substring(0, 500));

    // Check authorization status
    console.log("\n--- Authorization Status ---");
    const isGitHubAuthorized = client.isAuthorized('github');
    const isGmailAuthorized = client.isAuthorized('gmail');
    console.log("GitHub authorized:", isGitHubAuthorized);
    console.log("Gmail authorized:", isGmailAuthorized);

    // Authorize if needed
    if (!isGitHubAuthorized) {
      console.log("\nAuthorizing GitHub...");
      await client.authorize('github');
      console.log("GitHub authorized!");
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (import.meta.main) {
  main().catch(console.error);
}

