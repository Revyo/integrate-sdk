/**
 * Session Detection Utilities
 * Auto-detect user context from common auth library cookies and sessions
 */

import type { MCPContext } from '../config/types.js';

/**
 * Common session cookie names used by popular auth libraries
 * Note: Currently auto-detected based on cookie names in specific functions
 */
// const SESSION_COOKIE_PATTERNS = [
//   'better-auth.session_token',
//   'next-auth.session-token',
//   '__Secure-next-auth.session-token',
//   '__session', // Clerk
//   'lucia_session', // Lucia
//   'auth_session', // Generic
//   'session', // Generic
// ];

/**
 * Try to decode a JWT token without verification (for reading claims only)
 * This is safe because we only read user ID, not verify authenticity
 * 
 * @param token - JWT token string
 * @returns Decoded payload or undefined if invalid
 */
export function tryDecodeJWT(token: string): any | undefined {
  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return undefined;
    }

    // Decode the payload (middle part)
    const payloadPart = parts[1];
    if (!payloadPart) {
      return undefined;
    }
    
    // Base64url decode
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    // Invalid JWT format
    return undefined;
  }
}

/**
 * Extract cookies from a Request object
 * 
 * @param request - Web Request object
 * @returns Map of cookie names to values
 */
function getCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const cookieHeader = request.headers.get('cookie');

  if (!cookieHeader) {
    return cookies;
  }

  // Parse cookie header
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    if (name && valueParts.length > 0) {
      const trimmedName = name.trim();
      const value = valueParts.join('=').trim();
      cookies.set(trimmedName, value);
    }
  }

  return cookies;
}

/**
 * Try to extract user context from Better Auth session
 * 
 * @param cookies - Cookie map
 * @returns MCPContext or undefined
 */
function tryBetterAuth(cookies: Map<string, string>): MCPContext | undefined {
  const sessionToken = cookies.get('better-auth.session_token');
  if (!sessionToken) {
    return undefined;
  }

  // Better Auth uses JWTs - try to decode
  const payload = tryDecodeJWT(sessionToken);
  if (!payload) {
    return undefined;
  }

  // Extract common fields from Better Auth JWT
  const userId = payload.sub || payload.userId || payload.user_id || payload.id;
  if (!userId) {
    return undefined;
  }

  return {
    userId,
    sessionId: payload.jti || payload.sessionId,
  };
}

/**
 * Try to extract user context from NextAuth session
 * 
 * @param cookies - Cookie map
 * @returns MCPContext or undefined
 */
function tryNextAuth(cookies: Map<string, string>): MCPContext | undefined {
  // Try both secure and non-secure cookie names
  const sessionToken = 
    cookies.get('__Secure-next-auth.session-token') ||
    cookies.get('next-auth.session-token');

  if (!sessionToken) {
    return undefined;
  }

  // NextAuth can use JWTs or random tokens
  // If it's a JWT, try to decode it
  if (sessionToken.includes('.')) {
    const payload = tryDecodeJWT(sessionToken);
    if (payload) {
      return {
        userId: payload.sub || payload.userId || payload.user_id || payload.id,
        sessionId: payload.jti,
      };
    }
  }

  // For non-JWT sessions, we can't extract userId without database access
  // Return undefined - user will need to provide getSessionContext callback
  return undefined;
}

/**
 * Try to extract user context from Clerk session
 * 
 * @param cookies - Cookie map
 * @returns MCPContext or undefined
 */
function tryClerk(cookies: Map<string, string>): MCPContext | undefined {
  const sessionToken = cookies.get('__session');
  if (!sessionToken) {
    return undefined;
  }

  // Clerk uses JWTs
  const payload = tryDecodeJWT(sessionToken);
  if (!payload) {
    return undefined;
  }

  // Extract Clerk-specific fields
  return {
    userId: payload.sub || payload.userId,
    organizationId: payload.org_id || payload.organizationId,
    sessionId: payload.sid || payload.sessionId,
  };
}

/**
 * Try to extract user context from Lucia session
 * 
 * @param cookies - Cookie map
 * @returns MCPContext or undefined
 */
function tryLucia(cookies: Map<string, string>): MCPContext | undefined {
  const sessionToken = cookies.get('lucia_session');
  if (!sessionToken) {
    return undefined;
  }

  // Lucia uses opaque session IDs - can't extract userId without database
  // Return session ID only
  return {
    sessionId: sessionToken,
  };
}

/**
 * Try to extract user context from generic session cookie
 * 
 * @param cookies - Cookie map
 * @returns MCPContext or undefined
 */
function tryGenericSession(cookies: Map<string, string>): MCPContext | undefined {
  // Try common generic cookie names
  const sessionToken = 
    cookies.get('auth_session') ||
    cookies.get('session');

  if (!sessionToken) {
    return undefined;
  }

  // If it looks like a JWT, try to decode
  if (sessionToken.includes('.')) {
    const payload = tryDecodeJWT(sessionToken);
    if (payload) {
      return {
        userId: payload.sub || payload.userId || payload.user_id || payload.id,
        sessionId: payload.jti || payload.sessionId || payload.sid,
      };
    }
  }

  // For opaque tokens, return session ID only
  return {
    sessionId: sessionToken,
  };
}

/**
 * Automatically detect user context from request cookies
 * Tries to extract userId, organizationId, etc. from common auth library sessions
 * 
 * This is a best-effort attempt - if automatic detection fails, users should
 * provide a custom getSessionContext callback
 * 
 * @param request - Web Request object
 * @returns User context or undefined if not detected
 * 
 * @example
 * ```typescript
 * const context = await detectSessionContext(request);
 * if (context?.userId) {
 *   console.log('User ID:', context.userId);
 * }
 * ```
 */
export async function detectSessionContext(request: Request): Promise<MCPContext | undefined> {
  const cookies = getCookies(request);

  // Try each auth library in order of popularity
  let context: MCPContext | undefined;

  // Try Better Auth
  context = tryBetterAuth(cookies);
  if (context?.userId) {
    return context;
  }

  // Try NextAuth
  context = tryNextAuth(cookies);
  if (context?.userId) {
    return context;
  }

  // Try Clerk
  context = tryClerk(cookies);
  if (context?.userId) {
    return context;
  }

  // Try Lucia
  context = tryLucia(cookies);
  if (context?.userId) {
    return context;
  }

  // Try generic sessions
  context = tryGenericSession(cookies);
  if (context?.userId) {
    return context;
  }

  // No user context detected
  return undefined;
}

