/**
 * OAuth Routes Entry Point
 * 
 * Import this in your framework's route file to automatically handle OAuth
 * 
 * @example Next.js
 * ```typescript
 * // app/api/integrate/oauth/[action]/route.ts
 * export * from 'integrate-sdk/oauth';
 * ```
 * 
 * @example TanStack Start
 * ```typescript
 * // app/routes/api/integrate/oauth/[action].ts
 * export * from 'integrate-sdk/oauth';
 * ```
 */

export { POST, GET } from './src/adapters/auto-routes.js';

