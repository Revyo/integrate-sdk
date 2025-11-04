/**
 * Next.js OAuth Redirect Handler
 * Handles OAuth callback redirects and forwards parameters to the client
 */

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
 * @param config - Redirect configuration
 * @returns Next.js route handler
 * 
 * @example
 * ```typescript
 * // app/oauth/callback/route.ts
 * import { createOAuthRedirectHandler } from 'integrate-sdk';
 * 
 * export const GET = createOAuthRedirectHandler({
 *   redirectUrl: '/dashboard',
 * });
 * ```
 */
export function createOAuthRedirectHandler(config?: OAuthRedirectConfig) {
  const redirectUrl = config?.redirectUrl || '/';
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

    // Redirect to the configured URL with OAuth params in the hash
    // Using hash to avoid sending sensitive params to the server
    const targetUrl = new URL(redirectUrl, req.url);
    targetUrl.hash = `oauth_callback=${encodeURIComponent(JSON.stringify({ code, state }))}`;
    
    return Response.redirect(targetUrl);
  };
}

