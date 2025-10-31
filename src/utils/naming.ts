/**
 * Naming conversion utilities
 * Helpers for converting between camelCase and snake_case
 */

/**
 * Convert camelCase to snake_case
 * 
 * @example
 * camelToSnake('getRepo') // 'get_repo'
 * camelToSnake('listOwnRepos') // 'list_own_repos'
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * 
 * @example
 * snakeToCamel('get_repo') // 'getRepo'
 * snakeToCamel('list_own_repos') // 'listOwnRepos'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a method name to a full tool name with plugin prefix
 * 
 * @example
 * methodToToolName('getRepo', 'github') // 'github_get_repo'
 * methodToToolName('sendEmail', 'gmail') // 'gmail_send_email'
 */
export function methodToToolName(methodName: string, pluginId: string): string {
  const snakeCaseMethod = camelToSnake(methodName);
  return `${pluginId}_${snakeCaseMethod}`;
}

/**
 * Convert a tool name to a method name (removes plugin prefix and converts to camelCase)
 * 
 * @example
 * toolNameToMethod('github_get_repo') // 'getRepo'
 * toolNameToMethod('gmail_send_email') // 'sendEmail'
 */
export function toolNameToMethod(toolName: string): string {
  // Remove the plugin prefix (everything before the first underscore)
  const withoutPrefix = toolName.replace(/^[^_]+_/, '');
  return snakeToCamel(withoutPrefix);
}

