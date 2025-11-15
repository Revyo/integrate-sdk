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
  // Use indirect access to avoid bundler issues with Expo and other tools
  // that don't support import.meta
  try {
    // Use Function constructor to avoid direct import.meta reference that causes
    // bundler parse errors in environments like Expo
    // @ts-ignore - Dynamic access to avoid bundler issues
    const getImportMeta = new Function('return typeof import.meta !== "undefined" ? import.meta : undefined');
    const importMeta = getImportMeta();

    if (importMeta && typeof importMeta.env === 'object' && importMeta.env !== null) {
      const value = (importMeta.env as Record<string, any>)[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
  } catch {
    // import.meta might not be available in all contexts, fall through
  }

  // Fallback to process.env (Node.js/React Native/Expo)
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

