/**
 * Adapters for various frameworks
 * 
 * Re-exports all adapter modules for convenient access
 */

// Re-export all adapters
export * from "./nextjs.js";
export * from "./node.js";
export * from "./solid-start.js";
export * from "./svelte-kit.js";
export * from "./tanstack-start.js";
export * from "./base-handler.js";

// Don't export auto-routes to avoid conflicts with server.ts GET/POST
// Users should import those directly if needed

