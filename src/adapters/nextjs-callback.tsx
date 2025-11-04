/**
 * Next.js OAuth Callback Handler
 * Provides a pre-built OAuth callback page component for Next.js App Router
 * 
 * This eliminates the need for users to manually create callback pages.
 */

'use client';

import { useEffect } from 'react';
import type { OAuthCallbackHandlerConfig } from '../oauth/types.js';

/**
 * OAuth Callback Page Component
 * 
 * This component:
 * 1. Extracts OAuth callback parameters (code, state, error) from URL
 * 2. Sends them to the opener window (for popup mode) via postMessage
 * 3. Stores them in sessionStorage (for redirect mode)
 * 4. Redirects to the configured URL
 * 
 * @param config - Callback handler configuration
 * 
 * @example
 * ```tsx
 * // app/oauth/callback/page.tsx
 * import { OAuthCallbackPage } from 'integrate-sdk/oauth-callback';
 * 
 * export default function CallbackPage() {
 *   return <OAuthCallbackPage redirectUrl="/dashboard" />;
 * }
 * ```
 */
export function OAuthCallbackPage(config?: OAuthCallbackHandlerConfig) {
  const redirectUrl = config?.redirectUrl || '/';
  const errorRedirectUrl = config?.errorRedirectUrl || '/auth-error';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Handle error case
    if (error) {
      const errorMsg = errorDescription || error;
      console.error('[OAuth Callback] Error:', errorMsg);
      window.location.href = `${errorRedirectUrl}?error=${encodeURIComponent(errorMsg)}`;
      return;
    }

    // Validate required params
    if (!code || !state) {
      console.error('[OAuth Callback] Missing code or state parameter');
      window.location.href = `${errorRedirectUrl}?error=${encodeURIComponent('Invalid OAuth callback')}`;
      return;
    }

    // For popup mode: send message to opener window
    if (window.opener) {
      // Send message immediately
      window.opener.postMessage(
        {
          type: 'oauth_callback',
          code,
          state,
        },
        '*'
      );

      // Close popup after a brief delay to ensure message is received
      setTimeout(() => {
        window.close();
      }, 100);
    } else {
      // For redirect mode: store in sessionStorage and redirect
      try {
        sessionStorage.setItem(
          'oauth_callback_params',
          JSON.stringify({ code, state })
        );
      } catch (e) {
        console.error('Failed to store OAuth callback params:', e);
      }

      // Redirect to the configured URL
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 500);
    }
  }, [redirectUrl, errorRedirectUrl]);

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
      }}
    >
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div
          style={{
            border: '3px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            borderTop: '3px solid white',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }}
        />
        <h1
          style={{
            margin: '0 0 0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
          }}
        >
          Authorization Complete
        </h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem' }}>
          This window will close automatically...
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Create a default export wrapper for easier usage
 * 
 * @example
 * ```tsx
 * // app/oauth/callback/page.tsx
 * import { createOAuthCallbackPage } from 'integrate-sdk/oauth-callback';
 * 
 * export default createOAuthCallbackPage({
 *   redirectUrl: '/dashboard',
 * });
 * ```
 */
export function createOAuthCallbackPage(config?: OAuthCallbackHandlerConfig) {
  return function OAuthCallback() {
    return <OAuthCallbackPage {...config} />;
  };
}
