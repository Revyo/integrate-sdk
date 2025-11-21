/**
 * OAuth Flow Example
 * 
 * This example demonstrates the full OAuth 2.0 Authorization Code Flow
 * with both popup and redirect modes.
 */

import {
  createMCPClient,
  githubIntegration,
  gmailIntegration,
} from "../src/index.js";

// ============================================
// Example 1: Popup Flow (Recommended for SPAs)
// ============================================
async function popupFlowExample() {
  console.log("=== Popup Flow Example ===\n");

  // Create client with popup OAuth flow
  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
        redirectUri: "http://localhost:3000/api/integrate/oauth/callback", // Your callback URL
      }),
    ],
    oauthFlow: {
      mode: 'popup',
      popupOptions: {
        width: 600,
        height: 700,
      },
    },
  });

  try {
    // Check if already authorized
    const isAuthorized = client.isAuthorized('github');
    console.log(`GitHub authorized: ${isAuthorized}`);

    if (!isAuthorized) {
      console.log("\nInitiating OAuth flow...");
      console.log("A popup window will open for authorization");

      // This will:
      // 1. Open a popup with GitHub's authorization page
      // 2. User approves permissions
      // 3. GitHub redirects to your callback URL
      // 4. Your callback page sends code back to this window
      // 5. SDK exchanges code for session token
      await client.authorize('github');

      console.log("✓ Authorization successful!");
    }

    // Now you can use GitHub tools
    const repos = await client.github.listOwnRepos({});
    console.log("\n✓ Successfully fetched repositories");
    console.log(`Result: ${JSON.stringify(repos).substring(0, 200)}...`);

  } catch (error) {
    console.error("Error:", error);
  }
}

// ============================================
// Example 2: Redirect Flow (Traditional Web Apps)
// ============================================
async function redirectFlowExample() {
  console.log("\n\n=== Redirect Flow Example ===\n");

  // Create client with redirect OAuth flow
  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
        redirectUri: "http://localhost:3000/api/integrate/oauth/callback",
      }),
    ],
    oauthFlow: {
      mode: 'redirect',
    },
  });

  // Check if we're on the callback page
  const urlParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (code && state) {
    // We're on the callback page - handle the OAuth callback
    console.log("Handling OAuth callback...");

    try {
      await client.handleOAuthCallback({ code, state });
      console.log("✓ Authorization successful!");

      // Save session token for future use
      const sessionToken = client.getSessionToken();
      if (sessionToken) {
        // Store in localStorage, cookie, or your backend
        console.log(`Session token: ${sessionToken.substring(0, 20)}...`);
      }

      // Redirect to main app or continue
      console.log("You can now use the client to call tools");

    } catch (error) {
      console.error("OAuth callback failed:", error);
    }
  } else {
    // Main page - check if authorized
    const isAuthorized = client.isAuthorized('github');
    console.log(`GitHub authorized: ${isAuthorized}`);

    if (!isAuthorized) {
      console.log("\nInitiating OAuth flow...");
      console.log("User will be redirected to GitHub for authorization");

      // This will redirect the entire window to GitHub's authorization page
      // After user approves, GitHub will redirect back to your callback URL
      await client.authorize('github');
      // Code execution stops here due to redirect
    } else {
      // Already authorized, can use tools
      console.log("Already authorized!");
    }
  }
}

// ============================================
// Example 3: Multiple Providers
// ============================================
async function multipleProvidersExample() {
  console.log("\n\n=== Multiple Providers Example ===\n");

  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
      gmailIntegration({
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
      }),
    ],
    oauthFlow: {
      mode: 'popup',
    },
  });

  // Get list of all authorized providers
  const authorizedList = client.authorizedProviders();
  console.log("Currently authorized:", authorizedList);

  // Check authorization status for each provider
  const githubStatus = await client.getAuthorizationStatus('github');
  const gmailStatus = await client.getAuthorizationStatus('gmail');

  console.log("\nDetailed Authorization Status:");
  console.log(`  GitHub: ${githubStatus.authorized ? '✓' : '✗'}`);
  console.log(`  Gmail:  ${gmailStatus.authorized ? '✓' : '✗'}`);

  // Authorize each provider that needs it
  if (!githubStatus.authorized) {
    console.log("\nAuthorizing GitHub...");
    await client.authorize('github');
  }

  if (!gmailStatus.authorized) {
    console.log("\nAuthorizing Gmail...");
    await client.authorize('gmail');
  }

  // Check authorized list again
  const updatedList = client.authorizedProviders();
  console.log("\n✓ All providers authorized:", updatedList);

  // Now you can use both services
  try {
    const repos = await client.github.listOwnRepos({});
    console.log("✓ GitHub: Fetched repositories");

    const messages = await client.gmail.listMessages({});
    console.log("✓ Gmail: Fetched messages");
  } catch (error) {
    console.error("Error calling tools:", error);
  }
}

// ============================================
// Example 4: Restoring Sessions
// ============================================
async function sessionRestorationExample() {
  console.log("\n\n=== Session Restoration Example ===\n");

  // Get session token from storage (localStorage, cookie, backend, etc.)
  const storedToken = 'your-stored-session-token'; // From previous OAuth flow

  // Create client with existing session token
  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
    ],
    sessionToken: storedToken, // Restore previous session
  });

  // Check if session is still valid
  const isAuthorized = client.isAuthorized('github');

  if (!isAuthorized) {
    console.log("Session expired, need to re-authorize");
    await client.authorize('github');
  } else {
    console.log("✓ Session is valid, ready to use");

    // Use the client
    const repos = await client.github.listOwnRepos({});
    console.log("✓ Successfully called GitHub API");
  }
}

// ============================================
// Example 5: Callback Page for Popup Flow
// ============================================
// This code would go in your callback HTML page (e.g., /oauth/callback.html)
async function callbackPageExample() {
  /*
  <!-- Your callback HTML page -->
  <!DOCTYPE html>
  <html>
  <head>
    <title>OAuth Callback</title>
    <script type="module">
      import { sendCallbackToOpener } from '@integrate/sdk';
      
      // Get parameters from URL
      const params = new URLSearchParams(window.location.search);
      
      // Send to opener window and close popup
      sendCallbackToOpener({
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error')
      });
    </script>
  </head>
  <body>
    <p>Authorization successful! This window will close automatically.</p>
  </body>
  </html>
  */

  console.log("\n\n=== Callback Page Example ===");
  console.log("See the code comment above for the callback HTML page implementation");
}

// ============================================
// Example 6: Custom Callback Handler
// ============================================
async function customCallbackExample() {
  console.log("\n\n=== Custom Callback Handler Example ===\n");

  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
    ],
    oauthFlow: {
      mode: 'popup',
      // Custom handler for OAuth callback
      onAuthCallback: async (provider, code, state) => {
        console.log(`Custom handler called for ${provider}`);
        console.log(`Code: ${code.substring(0, 20)}...`);
        console.log(`State: ${state}`);

        // You can do custom processing here
        // e.g., analytics, logging, state management, etc.
      },
    },
  });

  const isAuthorized = client.isAuthorized('github');

  if (!isAuthorized) {
    await client.authorize('github');
  }

  console.log("✓ Authorization complete with custom handler");
}

// ============================================
// Example 7: Error Handling
// ============================================
async function errorHandlingExample() {
  console.log("\n\n=== Error Handling Example ===\n");

  const client = createMCPClient({
    integrations: [
      githubIntegration({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ["repo", "user"],
      }),
    ],
    oauthFlow: {
      mode: 'popup',
    },
  });

  try {
    const isAuthorized = client.isAuthorized('github');

    if (!isAuthorized) {
      await client.authorize('github');
    }

    // Try to use the API
    const repos = await client.github.listOwnRepos({});
    console.log("✓ Success!");

  } catch (error) {
    if (error instanceof Error) {
      // Handle different error types
      if (error.message.includes('popup was closed')) {
        console.error("User closed the authorization popup");
        // Show message to user
      } else if (error.message.includes('timeout')) {
        console.error("Authorization timed out");
        // Retry or show message
      } else if (error.message.includes('OAuth error')) {
        console.error("OAuth provider returned an error");
        // Show error to user
      } else {
        console.error("Unexpected error:", error.message);
      }
    }
  }
}

// ============================================
// Run Examples
// ============================================
async function main() {
  console.log("OAuth Flow Examples");
  console.log("===================\n");

  // Uncomment the examples you want to run:

  // await popupFlowExample();
  // await redirectFlowExample();
  // await multipleProvidersExample();
  // await sessionRestorationExample();
  // await callbackPageExample();
  // await customCallbackExample();
  // await errorHandlingExample();

  console.log("\n✓ Examples complete");
  console.log("\nNote: Uncomment the examples in main() to run them");
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

