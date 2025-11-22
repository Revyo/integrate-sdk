/**
 * Auto-generated OAuth Routes
 * Automatically creates the correct route handlers based on framework detection
 */

import { OAuthHandler, type OAuthHandlerConfig } from './base-handler.js';

/**
 * Global OAuth configuration
 * Set by createMCPClient when oauthConfig is provided
 */
let globalOAuthConfig: OAuthHandlerConfig | null = null;

/**
 * Set the global OAuth configuration
 * Called internally by createMCPClient
 */
export function setGlobalOAuthConfig(config: OAuthHandlerConfig): void {
  globalOAuthConfig = config;
}

/**
 * Get the global OAuth configuration
 */
export function getGlobalOAuthConfig(): OAuthHandlerConfig | null {
  return globalOAuthConfig;
}

/**
 * Universal OAuth route handler
 * Automatically detects framework and handles all OAuth actions
 * 
 * This is the magic function that makes everything "just work"
 * 
 * @example
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts (Next.js)
 * export * from 'integrate-sdk/oauth';
 * ```
 * 
 * @example
 * ```typescript
 * // app/routes/api/integrate/oauth/[action].ts (TanStack Start)
 * export * from 'integrate-sdk/oauth';
 * ```
 */

// Framework detection helpers (unused but kept for future enhancements)
// function isNextJS(request: any): boolean {
//   return (
//     request?.constructor?.name === 'NextRequest' ||
//     typeof request?.nextUrl !== 'undefined' ||
//     typeof (globalThis as any).NextResponse !== 'undefined'
//   );
// }

// function isTanStackStart(request: any): boolean {
//   return (
//     request instanceof Request &&
//     !isNextJS(request)
//   );
// }

/**
 * Universal POST handler
 * Handles authorize, callback, and disconnect actions
 */
export async function POST(
  req: any,
  context?: { params: { action: string } }
): Promise<any> {
  if (!globalOAuthConfig) {
    throw new Error(
      'OAuth configuration not found. Did you configure oauthProviders in createMCPClient?'
    );
  }

  const handler = new OAuthHandler(globalOAuthConfig);
  const action = context?.params?.action;

  if (!action) {
    return createErrorResponse('Missing action parameter', 400);
  }

  try {
    if (action === 'authorize') {
      // Pass full Request object for context detection
      const result = await handler.handleAuthorize(req);
      const response = createSuccessResponse(result);
      
      // Add Set-Cookie header if context cookie was created
      if (result.setCookie) {
        response.headers?.set?.('Set-Cookie', result.setCookie);
      }
      
      return response;
    }

    if (action === 'callback') {
      // Pass full Request object for context restoration
      const result = await handler.handleCallback(req);
      const response = createSuccessResponse(result);
      
      // Add Set-Cookie header to clear context cookie
      if (result.clearCookie) {
        response.headers?.set?.('Set-Cookie', result.clearCookie);
      }
      
      return response;
    }

    if (action === 'disconnect') {
      const body = await parseRequestBody(req);
      const accessToken = extractAccessToken(req);
      
      if (!accessToken) {
        return createErrorResponse('Missing or invalid Authorization header', 400);
      }
      
      if (!body.provider) {
        return createErrorResponse('Missing provider in request body', 400);
      }
      
      // Pass the request object for context extraction
      const result = await handler.handleDisconnect({ provider: body.provider }, accessToken, req);
      return createSuccessResponse(result);
    }

    return createErrorResponse(`Unknown action: ${action}`, 404);
  } catch (error: any) {
    console.error(`[OAuth ${action}] Error:`, error);
    return createErrorResponse(error.message, 500);
  }
}

/**
 * Universal GET handler
 * Handles status action
 */
export async function GET(
  req: any,
  context?: { params: { action: string } }
): Promise<any> {
  if (!globalOAuthConfig) {
    throw new Error(
      'OAuth configuration not found. Did you configure oauthProviders in createMCPClient?'
    );
  }

  const handler = new OAuthHandler(globalOAuthConfig);
  const action = context?.params?.action;

  if (!action) {
    return createErrorResponse('Missing action parameter', 400);
  }

  try {
    if (action === 'status') {
      const provider = extractProvider(req);
      const accessToken = extractAccessToken(req);

      if (!provider) {
        return createErrorResponse('Missing provider parameter', 400);
      }

      if (!accessToken) {
        return createErrorResponse('Missing or invalid Authorization header', 400);
      }

      const result = await handler.handleStatus(provider, accessToken);
      return createSuccessResponse(result);
    }

    return createErrorResponse(`Unknown action: ${action}`, 404);
  } catch (error: any) {
    console.error(`[OAuth ${action}] Error:`, error);
    return createErrorResponse(error.message, 500);
  }
}

/**
 * Parse request body (works for both Next.js and standard Request)
 */
async function parseRequestBody(req: any): Promise<any> {
  if (typeof req.json === 'function') {
    return await req.json();
  }
  throw new Error('Unable to parse request body');
}

/**
 * Extract access token from Authorization header (works for both Next.js and standard Request)
 */
function extractAccessToken(req: any): string | undefined {
  if (req.headers?.get) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }
  return undefined;
}

/**
 * Extract provider from query parameters (works for both Next.js and standard Request)
 */
function extractProvider(req: any): string | undefined {
  let url: URL;

  // Next.js
  if (req.nextUrl) {
    url = new URL(req.nextUrl);
  }
  // Standard Request
  else if (req.url) {
    url = new URL(req.url);
  } else {
    return undefined;
  }

  return url.searchParams.get('provider') || undefined;
}

/**
 * Create success response (works for both frameworks)
 */
function createSuccessResponse(data: any): any {
  // Try Next.js first
  if (typeof (globalThis as any).NextResponse !== 'undefined') {
    const NextResponse = (globalThis as any).NextResponse;
    return NextResponse.json(data);
  }

  // Fallback to standard Response
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create error response (works for both frameworks)
 */
function createErrorResponse(message: string, status: number): any {
  // Try Next.js first
  if (typeof (globalThis as any).NextResponse !== 'undefined') {
    const NextResponse = (globalThis as any).NextResponse;
    return NextResponse.json({ error: message }, { status });
  }

  // Fallback to standard Response
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

