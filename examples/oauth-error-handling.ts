/**
 * OAuth Error Handling Example
 * 
 * Shows how to configure error handling for OAuth callbacks
 * when the SDK automatically processes #oauth_callback={...} from the URL
 */

import { createMCPClient } from "../index.js";
import { githubIntegration } from "../integrations.js";

// Example 1: Silent mode (default)
// Errors are suppressed and URL hash is cleaned up
const clientSilent = createMCPClient({
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
  // Default behavior - no console errors
  oauthCallbackErrorBehavior: {
    mode: 'silent',
  },
});

// Example 2: Console mode
// Errors are logged to console for debugging
const clientConsole = createMCPClient({
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
  oauthCallbackErrorBehavior: {
    mode: 'console', // Log errors to console
  },
});

// Example 3: Redirect mode
// Redirect to an error page on OAuth callback failure
const clientRedirect = createMCPClient({
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
  oauthCallbackErrorBehavior: {
    mode: 'redirect',
    redirectUrl: '/auth-error', // Redirect here on error
  },
});

// Example 4: Disable automatic callback handling entirely
const clientManual = createMCPClient({
  integrations: [
    githubIntegration({
      clientId: process.env.GITHUB_CLIENT_ID || 'your-client-id',
    }),
  ],
  autoHandleOAuthCallback: false, // Handle callbacks manually
});

// Manually handle OAuth callback if needed
if (typeof window !== 'undefined' && window.location.hash.includes('oauth_callback=')) {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const oauthCallbackData = hashParams.get('oauth_callback');
  
  if (oauthCallbackData) {
    try {
      const callbackParams = JSON.parse(decodeURIComponent(oauthCallbackData));
      
      clientManual.handleOAuthCallback(callbackParams)
        .then(() => {
          console.log('OAuth callback handled successfully');
          // Clean up URL
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((error) => {
          console.error('OAuth callback failed:', error);
          // Custom error handling
          window.location.href = '/custom-error-page';
        });
    } catch (error) {
      console.error('Failed to parse OAuth callback:', error);
    }
  }
}

/**
 * Common OAuth error scenarios that are now handled gracefully:
 * 
 * 1. Expired OAuth flow (older than 5 minutes)
 *    - Error: "OAuth flow expired: please try again"
 *    - Old behavior: Console error on every page load
 *    - New behavior: Silent cleanup (default) or custom handling
 * 
 * 2. Missing OAuth flow (localStorage cleared or different browser)
 *    - Error: "Invalid state parameter: no matching OAuth flow found"
 *    - Old behavior: Console error on every page load
 *    - New behavior: Silent cleanup (default) or custom handling
 * 
 * 3. Callback URL with hash fragment stuck in URL
 *    - Old behavior: Error logged repeatedly on each import
 *    - New behavior: Hash cleaned up automatically, no repeated errors
 */

export { 
  clientSilent,
  clientConsole,
  clientRedirect,
  clientManual,
};

