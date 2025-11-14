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
  // Try import.meta.env first (Vite/browser)
  // Check if we're in a Vite environment
  try {
    // Use a function to safely access import.meta
    const getMetaEnv = () => {
      try {
        // @ts-ignore - import.meta is a special syntax that may not be available in all environments
        return typeof import.meta !== 'undefined' ? import.meta.env : undefined;
      } catch {
        return undefined;
      }
    };

    const metaEnv = getMetaEnv();
    if (metaEnv && typeof metaEnv === 'object' && metaEnv !== null) {
      const value = (metaEnv as Record<string, any>)[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  } catch {
    // import.meta might not be available in all contexts
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

