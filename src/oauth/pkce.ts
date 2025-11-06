/**
 * PKCE Utilities
 * Proof Key for Code Exchange (RFC 7636) implementation
 * 
 * PKCE enhances OAuth 2.0 security by preventing authorization code interception attacks.
 * It's especially important for public clients (browser/mobile apps).
 */

/**
 * Generate a cryptographically secure random code verifier
 * Must be 43-128 characters long, using [A-Z] [a-z] [0-9] - . _ ~
 * 
 * @returns A random code verifier string
 * 
 * @example
 * ```typescript
 * const verifier = generateCodeVerifier();
 * // Returns: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
 * ```
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (will be 43 characters when base64url encoded)
  const array = new Uint8Array(32);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Browser/modern environment
    crypto.getRandomValues(array);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    // Node.js 19+
    (globalThis as any).crypto.getRandomValues(array);
  } else {
    // Fallback for older Node.js
    throw new Error('crypto.getRandomValues is not available. Please use Node.js 19+ or a modern browser.');
  }
  
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from verifier using SHA-256
 * 
 * @param verifier - The code verifier to hash
 * @returns A Promise resolving to the base64url-encoded SHA-256 hash
 * 
 * @example
 * ```typescript
 * const verifier = generateCodeVerifier();
 * const challenge = await generateCodeChallenge(verifier);
 * // Returns: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
 * ```
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  // Convert verifier to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  
  // Hash with SHA-256
  let hashBuffer: ArrayBuffer;
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser/modern environment
    hashBuffer = await crypto.subtle.digest('SHA-256', data);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
    // Node.js 19+
    hashBuffer = await (globalThis as any).crypto.subtle.digest('SHA-256', data);
  } else {
    // Fallback for older Node.js
    throw new Error('crypto.subtle.digest is not available. Please use Node.js 19+ or a modern browser.');
  }
  
  // Convert to base64url
  return base64UrlEncode(new Uint8Array(hashBuffer));
}

/**
 * Generate a random state parameter for CSRF protection
 * 
 * @returns A random state string
 * 
 * @example
 * ```typescript
 * const state = generateState();
 * // Returns: "xyzABC123"
 * ```
 */
export function generateState(): string {
  // Generate 16 random bytes (will be 22 characters when base64url encoded)
  const array = new Uint8Array(16);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
    (globalThis as any).crypto.getRandomValues(array);
  } else {
    throw new Error('crypto.getRandomValues is not available. Please use Node.js 19+ or a modern browser.');
  }
  
  return base64UrlEncode(array);
}

/**
 * Generate a state parameter with optional return URL
 * Encodes both CSRF token and return URL for dynamic post-OAuth redirects
 * 
 * @param returnUrl - Optional URL to redirect to after OAuth completion
 * @returns A state string encoding both CSRF token and returnUrl
 * 
 * @example
 * ```typescript
 * // Simple state without return URL
 * const state = generateStateWithReturnUrl();
 * 
 * // State with return URL
 * const state = generateStateWithReturnUrl('/marketplace/github');
 * ```
 */
export function generateStateWithReturnUrl(returnUrl?: string): string {
  const csrf = generateState(); // Generate random CSRF token
  const stateData = returnUrl ? { csrf, returnUrl } : { csrf };
  
  // Encode the state data as JSON, then base64url encode it
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(JSON.stringify(stateData));
  return base64UrlEncode(jsonBytes);
}

/**
 * Parse a state parameter to extract CSRF token and optional return URL
 * Handles both old format (plain string) and new format (JSON object)
 * 
 * @param state - The state parameter to parse
 * @returns Object containing csrf token and optional returnUrl
 * 
 * @example
 * ```typescript
 * const stateData = parseState(state);
 * console.log(stateData.csrf); // CSRF token
 * console.log(stateData.returnUrl); // Return URL (if present)
 * ```
 */
export function parseState(state: string): { csrf: string; returnUrl?: string } {
  try {
    const decoded = base64UrlDecode(state);
    const parsed = JSON.parse(decoded);
    
    // Handle both old (string) and new (object) state formats
    if (typeof parsed === 'string') {
      // Old format: plain CSRF token
      return { csrf: parsed };
    } else if (parsed && typeof parsed === 'object') {
      // New format: { csrf, returnUrl? }
      return {
        csrf: parsed.csrf || state, // Fallback to original state if no csrf field
        returnUrl: parsed.returnUrl,
      };
    }
    
    // Fallback: treat as plain CSRF token
    return { csrf: state };
  } catch {
    // If parsing fails (invalid JSON or base64), treat as plain CSRF token
    // This maintains backward compatibility with old state parameters
    return { csrf: state };
  }
}

/**
 * Base64url encode a Uint8Array
 * Base64url encoding uses URL-safe characters (no +, /, =)
 * 
 * @param array - The byte array to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(array: Uint8Array): string {
  // Convert to base64
  let base64 = '';
  
  if (typeof Buffer !== 'undefined') {
    // Node.js
    base64 = Buffer.from(array).toString('base64');
  } else {
    // Browser
    const binary = String.fromCharCode(...array);
    base64 = btoa(binary);
  }
  
  // Convert to base64url (replace +/= with -_)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decode a string to UTF-8 text
 * Reverses base64url encoding and converts to string
 * 
 * @param str - The base64url-encoded string to decode
 * @returns Decoded UTF-8 string
 */
function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  
  if (typeof Buffer !== 'undefined') {
    // Node.js
    return Buffer.from(base64, 'base64').toString('utf-8');
  } else {
    // Browser
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }
}

