/**
 * Next.js OAuth Callback Handler
 * Provides a pre-built OAuth callback route handler for Next.js App Router
 * 
 * This eliminates the need for users to manually create callback pages.
 */

import type { OAuthCallbackHandlerConfig } from '../oauth/types.js';

// Type-only imports to avoid requiring Next.js at build time
type NextRequest = any;
type NextResponse = any;

/**
 * Create Next.js OAuth callback route handler
 * 
 * This handler serves an HTML page that:
 * 1. Extracts OAuth callback parameters (code, state, error) from URL
 * 2. Sends them to the opener window (for popup mode) or parent window (for redirect mode)
 * 3. Redirects to the configured URL
 * 
 * @param config - Callback handler configuration
 * @returns Object with GET handler for Next.js routes
 * 
 * @example
 * ```typescript
 * // app/oauth/callback/route.ts
 * import { createNextOAuthCallbackHandler } from 'integrate-sdk';
 * 
 * export const GET = createNextOAuthCallbackHandler({
 *   redirectUrl: '/dashboard', // Optional, defaults to '/'
 * });
 * ```
 */
export function createNextOAuthCallbackHandler(config?: OAuthCallbackHandlerConfig) {
  const redirectUrl = config?.redirectUrl || '/';
  const errorRedirectUrl = config?.errorRedirectUrl || '/auth-error';

  return {
    /**
     * GET handler for OAuth callback
     * Serves an HTML page that processes the OAuth callback
     */
    async GET(req: NextRequest): Promise<NextResponse> {
      const { searchParams } = new URL(req.url);
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // If there's an error, redirect to error page
      if (error) {
        const errorMsg = errorDescription || error;
        console.error('[OAuth Callback] Error:', errorMsg);
        
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${errorRedirectUrl}?error=${encodeURIComponent(errorMsg)}`,
          },
        });
      }

      // If missing code or state, this is an invalid callback
      if (!code || !state) {
        console.error('[OAuth Callback] Missing code or state parameter');
        
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${errorRedirectUrl}?error=${encodeURIComponent('Invalid OAuth callback')}`,
          },
        });
      }

      // Serve HTML page that handles the callback
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Completing Authorization...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 3px solid white;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
    }
    p {
      margin: 0;
      opacity: 0.9;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Authorization Complete</h1>
    <p>This window will close automatically...</p>
  </div>
  <script>
    (function() {
      const code = ${JSON.stringify(code)};
      const state = ${JSON.stringify(state)};
      const redirectUrl = ${JSON.stringify(redirectUrl)};

      // For popup mode: send message to opener window
      if (window.opener) {
        // Send message immediately
        window.opener.postMessage({
          type: 'oauth_callback',
          code: code,
          state: state,
        }, '*');
        
        // Close popup after a brief delay to ensure message is received
        // Using a shorter delay to prevent race conditions with popup monitor
        setTimeout(() => {
          window.close();
        }, 100);
      } else {
        // For redirect mode: store in sessionStorage and redirect
        // The SDK will pick this up from sessionStorage
        try {
          sessionStorage.setItem('oauth_callback_params', JSON.stringify({
            code: code,
            state: state,
          }));
        } catch (e) {
          console.error('Failed to store OAuth callback params:', e);
        }
        
        // Redirect to the configured URL
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      }
    })();
  </script>
</body>
</html>
      `.trim();

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    },
  };
}

