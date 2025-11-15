/**
 * Environment variable utility
 * Supports both Node.js (process.env) and Vite (import.meta.env) environments
 */

/**
 * Get an environment variable from either import.meta.env (Vite) or process.env (Node.js)
 * @param key - Environment variable key
 * @returns Environment variable value or undefined
 */
export function getEnv(key: string): string | undefined {
  // Try import.meta.env first (Vite/Astro)
  // In Vite, import.meta.env is available at runtime in server-side code
  // We need to access it directly since import.meta is a compile-time construct
  try {
    // Direct access to import.meta.env (works in Vite/Astro server-side)
    // @ts-ignore - import.meta.env is Vite-specific and may not be available in all environments
    const metaEnv = import.meta.env;
    if (metaEnv && typeof metaEnv === 'object' && metaEnv !== null) {
      const value = (metaEnv as Record<string, any>)[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  } catch {
    // import.meta might not be available in all contexts (e.g., pure Node.js), fall through
  }
  
  // Fallback to process.env (Node.js)
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Get an environment variable with a fallback value
 * @param key - Environment variable key
 * @param fallback - Fallback value if env var is not set
 * @returns Environment variable value or fallback
 */
export function getEnvWithFallback(key: string, fallback: string): string {
  return getEnv(key) ?? fallback;
}

/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Replace the current URL without adding to history
 * Uses SvelteKit's navigation API if available, otherwise falls back to standard History API
 * 
 * This prevents the SvelteKit warning about using window.history.replaceState
 * 
 * @param url - The URL to replace with (path + search params)
 */
export async function safeReplaceState(url: string): Promise<void> {
  if (!isBrowser()) {
    return;
  }

  // Try to detect and use SvelteKit's navigation
  try {
    // Try to dynamically import SvelteKit's navigation module
    // This will only work in SvelteKit apps
    // @ts-ignore - $app/navigation only exists in SvelteKit environments
    const navigation = await import('$app/navigation').catch(() => null);
    
    if (navigation && typeof navigation.goto === 'function') {
      // Use SvelteKit's goto with replaceState
      await navigation.goto(url, { 
        replaceState: true, 
        keepFocus: true, 
        noScroll: true 
      });
      return;
    }
  } catch (e) {
    // Not in SvelteKit or module not available
  }

  // Fall back to standard History API for non-SvelteKit environments
  window.history.replaceState(null, '', url);
}

