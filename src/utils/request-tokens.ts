/**
 * Request token extraction utility
 * Supports automatic extraction of provider tokens from request headers across multiple frameworks
 */

/**
 * Extract provider tokens from request headers across multiple frameworks
 * 
 * This function attempts to automatically extract the `x-integrate-tokens` header
 * from the current request context. It supports multiple frameworks including:
 * - Next.js (App Router with headers() function from 'next/headers')
 * - Nuxt (via useRequestHeaders composable)
 * - Other frameworks via environment variables
 * 
 * If automatic extraction fails, it falls back to the `PROVIDER_TOKENS` environment variable.
 * 
 * **Note**: This function works best in server-side contexts where framework-specific
 * request context is available. For client-side or contexts without request access,
 * tokens must be passed manually via the options parameter.
 * 
 * @param manualTokens - Optional manually provided tokens (takes precedence over auto-extraction)
 * @returns Promise resolving to record of provider names to access tokens
 * @throws Error if tokens cannot be extracted from any source
 * 
 * @example
 * ```typescript
 * // Auto-extraction in Next.js API route
 * import { getVercelAITools } from 'integrate-sdk';
 * 
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   
 *   // Tokens are automatically extracted from request headers
 *   const tools = await getVercelAITools(serverClient);
 *   
 *   const result = streamText({
 *     model: "openai/gpt-4",
 *     messages,
 *     tools,
 *   });
 *   
 *   return result.toUIMessageStreamResponse();
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Manual override when auto-extraction isn't available
 * const tools = await getVercelAITools(serverClient, {
 *   providerTokens: {
 *     github: 'ghp_...',
 *     gmail: 'ya29...'
 *   }
 * });
 * ```
 */
export async function getProviderTokens(manualTokens?: Record<string, string>): Promise<Record<string, string>> {
    // Manual tokens take precedence
    if (manualTokens) {
        return manualTokens;
    }

    let tokensString: string | null | undefined = null;

    // Strategy 1: Try Next.js headers() function from 'next/headers'
    // This uses AsyncLocalStorage and works in Next.js App Router server components
    if (!tokensString) {
        try {
            // Dynamic import to avoid requiring Next.js at build time
            // @ts-ignore, we don't have this bundled
            const nextHeaders = await import('next/headers').catch(() => null);
            if (nextHeaders && typeof nextHeaders.headers === 'function') {
                // Next.js 15+ returns a Promise, earlier versions return the headers directly
                const headersList = await Promise.resolve(nextHeaders.headers());
                tokensString = headersList.get('x-integrate-tokens');
            }
        } catch {
            // Next.js not available or headers() not accessible
        }
    }

    // Strategy 2: Try Nuxt's useRequestHeaders composable
    // This works in Nuxt server routes and middleware
    if (!tokensString) {
        try {
            // Use Function constructor to avoid parse errors in non-Nuxt environments
            const getNuxtHeaders = new Function(`
        try {
          if (typeof useRequestHeaders === 'function') {
            return useRequestHeaders();
          }
        } catch {}
        return null;
      `);
            const headers = getNuxtHeaders();
            if (headers && typeof headers === 'object') {
                tokensString = headers['x-integrate-tokens'];
            }
        } catch {
            // Nuxt not available
        }
    }

    // Strategy 3: Fallback to environment variable
    // Useful for testing or when tokens are configured server-side
    if (!tokensString) {
        if (typeof process !== 'undefined' && process.env) {
            tokensString = process.env.PROVIDER_TOKENS;
        }
    }

    // Parse and validate tokens
    if (tokensString) {
        try {
            const parsed = JSON.parse(tokensString);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, string>;
            }
        } catch (error) {
            throw new Error(
                `Failed to parse provider tokens: ${error instanceof Error ? error.message : 'Invalid JSON'}`
            );
        }
    }

    // No tokens found - throw error
    throw new Error(
        'Provider tokens not found. Please pass tokens manually via options.providerTokens or set the x-integrate-tokens header in your request.'
    );
}

/**
 * Try to extract provider tokens without throwing an error
 * 
 * Similar to getProviderTokens() but returns null instead of throwing when tokens cannot be found.
 * Useful for optional token extraction scenarios.
 * 
 * @param manualTokens - Optional manually provided tokens
 * @returns Promise resolving to record of provider names to access tokens, or null if not found
 * 
 * @example
 * ```typescript
 * const tokens = await tryGetProviderTokens();
 * if (tokens) {
 *   // Use tokens
 * } else {
 *   // Handle missing tokens
 * }
 * ```
 */
export async function tryGetProviderTokens(manualTokens?: Record<string, string>): Promise<Record<string, string> | null> {
    try {
        return await getProviderTokens(manualTokens);
    } catch {
        return null;
    }
}

