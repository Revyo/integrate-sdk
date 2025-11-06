/**
 * Next.js OAuth Redirect Handler
 * Handles OAuth callback redirects and forwards parameters to the client
 */

import { parseState } from '../oauth/pkce.js';

// Type-only imports to avoid requiring Next.js at build time
type NextRequest = any;
type NextResponse = any;

export interface OAuthRedirectConfig {
  /** URL to redirect to after OAuth callback (default: '/') */
  redirectUrl?: string;
  /** URL to redirect to on OAuth error (default: '/auth-error') */
  errorRedirectUrl?: string;
}

/**
 * Create OAuth redirect handler for Next.js
 * 
 * This handler processes OAuth callbacks from providers and redirects
 * to your application with the OAuth parameters encoded in the URL.
 * 
 * The handler automatically extracts the return URL from the state parameter
 * (if provided during authorization), with fallbacks to referrer or configured URL.
 * 
 * @param config - Redirect configuration
 * @returns Next.js route handler
 * 
 * @example
 * ```typescript
 * // app/oauth/callback/route.ts
 * import { createOAuthRedirectHandler } from 'integrate-sdk';
 * 
 * // Simple usage with fallback URL
 * export const GET = createOAuthRedirectHandler({
 *   redirectUrl: '/', // Fallback if no return URL in state
 * });
 * 
 * // Dynamic return URLs work automatically when using client.authorize()
 * // await client.authorize('github', { returnUrl: '/marketplace/github' });
 * ```
 */
export function createOAuthRedirectHandler(config?: OAuthRedirectConfig) {
  const defaultRedirectUrl = config?.redirectUrl || '/';
  const errorRedirectUrl = config?.errorRedirectUrl || '/auth-error';

  return async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url);
    
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth error
    if (error) {
      const errorMsg = errorDescription || error;
      console.error('[OAuth Redirect] Error:', errorMsg);
      
      return Response.redirect(
        new URL(`${errorRedirectUrl}?error=${encodeURIComponent(errorMsg)}`, req.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[OAuth Redirect] Missing code or state parameter');
      
      return Response.redirect(
        new URL(`${errorRedirectUrl}?error=${encodeURIComponent('Invalid OAuth callback')}`, req.url)
      );
    }

    // Extract returnUrl from state parameter (with fallbacks)
    let returnUrl = defaultRedirectUrl;
    
    try {
      // Try to parse state to extract returnUrl
      const stateData = parseState(state);
      if (stateData.returnUrl) {
        returnUrl = stateData.returnUrl;
      }
    } catch (e) {
      // If parsing fails, try to use referrer as fallback
      try {
        const referrer = req.headers?.get?.('referer') || req.headers?.get?.('referrer');
        if (referrer) {
          const referrerUrl = new URL(referrer);
          const currentUrl = new URL(req.url);
          
          // Only use referrer if it's from the same origin (security)
          if (referrerUrl.origin === currentUrl.origin) {
            returnUrl = referrerUrl.pathname + referrerUrl.search;
          }
        }
      } catch {
        // If referrer parsing fails, use default
        // (already set to defaultRedirectUrl)
      }
    }

    // Redirect to the return URL with OAuth params in the hash
    // Using hash to avoid sending sensitive params to the server
    const targetUrl = new URL(returnUrl, req.url);
    targetUrl.hash = `oauth_callback=${encodeURIComponent(JSON.stringify({ code, state }))}`;
    
    return Response.redirect(targetUrl);
  };
}

