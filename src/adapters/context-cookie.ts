/**
 * Context Cookie Manager
 * Securely store and retrieve user context between OAuth authorization and callback
 */

import type { MCPContext } from '../config/types.js';

/**
 * Cookie name for storing OAuth context
 */
export const CONTEXT_COOKIE_NAME = '__integrate_oauth_ctx';

/**
 * Cookie TTL in seconds (5 minutes - enough for OAuth flow)
 */
export const CONTEXT_COOKIE_MAX_AGE = 300;

/**
 * Context cookie payload structure
 */
interface ContextCookiePayload {
  context: MCPContext;
  provider: string;
  timestamp: number;
}

/**
 * Derive an encryption key from a secret string
 * Uses PBKDF2 to derive a 256-bit key suitable for AES-GCM
 * 
 * @param secret - Secret string (API key or provider secret)
 * @returns CryptoKey for encryption/decryption
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  // Encode the secret
  const encoder = new TextEncoder();
  const secretData = encoder.encode(secret);

  // Import as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a 256-bit AES-GCM key
  // Use a fixed salt since we need deterministic key derivation
  const salt = encoder.encode('integrate-oauth-context-v1');

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt and sign a context payload
 * 
 * @param payload - Context payload to encrypt
 * @param secret - Secret for encryption
 * @returns Encrypted cookie value (base64url encoded)
 */
async function encryptPayload(payload: ContextCookiePayload, secret: string): Promise<string> {
  // Derive encryption key
  const key = await deriveKey(secret);

  // Generate random IV (96 bits for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode payload as JSON
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));

  // Encrypt with AES-GCM (provides both encryption and authentication)
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Encode as base64url
  return base64UrlEncode(combined);
}

/**
 * Decrypt and verify a context payload
 * 
 * @param cookieValue - Encrypted cookie value
 * @param secret - Secret for decryption
 * @returns Decrypted payload or undefined if invalid
 */
async function decryptPayload(cookieValue: string, secret: string): Promise<ContextCookiePayload | undefined> {
  try {
    // Decode from base64url
    const combined = base64UrlDecode(cookieValue);

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Derive decryption key
    const key = await deriveKey(secret);

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encrypted
    );

    // Decode JSON
    const decoder = new TextDecoder();
    const json = decoder.decode(decrypted);
    const payload = JSON.parse(json) as ContextCookiePayload;

    // Validate timestamp (reject if older than TTL)
    const age = Date.now() - payload.timestamp;
    if (age > CONTEXT_COOKIE_MAX_AGE * 1000) {
      return undefined;
    }

    return payload;
  } catch (error) {
    // Decryption failed or invalid format
    return undefined;
  }
}

/**
 * Base64url encode a Uint8Array
 * 
 * @param data - Data to encode
 * @returns Base64url encoded string
 */
function base64UrlEncode(data: Uint8Array): string {
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...data));
  
  // Convert to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decode to Uint8Array
 * 
 * @param str - Base64url encoded string
 * @returns Decoded data
 */
function base64UrlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  // Decode base64
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

/**
 * Create an encrypted context cookie value
 * 
 * @param context - User context to store
 * @param provider - OAuth provider name
 * @param secret - Secret for encryption (API key or provider secret)
 * @returns Encrypted cookie value
 * 
 * @example
 * ```typescript
 * const cookieValue = await createContextCookie(
 *   { userId: 'user123' },
 *   'github',
 *   process.env.API_KEY
 * );
 * ```
 */
export async function createContextCookie(
  context: MCPContext,
  provider: string,
  secret: string
): Promise<string> {
  const payload: ContextCookiePayload = {
    context,
    provider,
    timestamp: Date.now(),
  };

  return await encryptPayload(payload, secret);
}

/**
 * Read and decrypt a context cookie
 * 
 * @param cookieValue - Encrypted cookie value
 * @param secret - Secret for decryption
 * @returns Decrypted context and provider, or undefined if invalid/expired
 * 
 * @example
 * ```typescript
 * const result = await readContextCookie(cookieValue, process.env.API_KEY);
 * if (result) {
 *   console.log('User ID:', result.context.userId);
 *   console.log('Provider:', result.provider);
 * }
 * ```
 */
export async function readContextCookie(
  cookieValue: string,
  secret: string
): Promise<{ context: MCPContext; provider: string } | undefined> {
  const payload = await decryptPayload(cookieValue, secret);
  if (!payload) {
    return undefined;
  }

  return {
    context: payload.context,
    provider: payload.provider,
  };
}

/**
 * Generate a Set-Cookie header value for the context cookie
 * 
 * @param cookieValue - Encrypted cookie value
 * @param maxAge - Cookie max age in seconds (default: 300 = 5 minutes)
 * @returns Set-Cookie header value
 * 
 * @example
 * ```typescript
 * const setCookieHeader = getSetCookieHeader(cookieValue);
 * response.headers.set('Set-Cookie', setCookieHeader);
 * ```
 */
export function getSetCookieHeader(cookieValue: string, maxAge: number = CONTEXT_COOKIE_MAX_AGE): string {
  const attributes = [
    `${CONTEXT_COOKIE_NAME}=${cookieValue}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
  ];

  return attributes.join('; ');
}

/**
 * Generate a Set-Cookie header value to clear the context cookie
 * 
 * @returns Set-Cookie header value that clears the cookie
 * 
 * @example
 * ```typescript
 * const clearCookieHeader = getClearCookieHeader();
 * response.headers.set('Set-Cookie', clearCookieHeader);
 * ```
 */
export function getClearCookieHeader(): string {
  const attributes = [
    `${CONTEXT_COOKIE_NAME}=`,
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
  ];

  return attributes.join('; ');
}

/**
 * Extract the context cookie value from a Request
 * 
 * @param request - Web Request object
 * @returns Cookie value or undefined if not present
 */
export function getContextCookieFromRequest(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return undefined;
  }

  // Parse cookies
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    if (name && name.trim() === CONTEXT_COOKIE_NAME) {
      return valueParts.join('=').trim();
    }
  }

  return undefined;
}

