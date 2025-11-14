/**
 * Shared utilities for AI provider integrations
 * 
 * Common functions used across different AI provider integrations
 */

import { z } from "zod";
import type { MCPClient } from "../client.js";

/**
 * Options for AI provider tool conversions
 */
export interface AIToolsOptions {
  /**
   * Provider tokens for server-side usage
   * Maps provider names (e.g., 'github', 'gmail') to their access tokens
   * 
   * @example
   * ```typescript
   * const tools = await getAITools(client, 'openai', {
   *   providerTokens: {
   *     github: 'ghp_...',
   *     gmail: 'ya29...'
   *   }
   * });
   * ```
   */
  providerTokens?: Record<string, string>;
}

/**
 * Get the provider for a tool by checking which plugin includes it
 * @internal
 */
export function getProviderForTool(client: MCPClient<any>, toolName: string): string | undefined {
  // Access the client's internal method to get provider for tool
  return (client as any).getProviderForTool?.(toolName);
}

/**
 * Convert a JSON Schema property to a Zod schema
 * @internal
 */
export function jsonSchemaPropertyToZod(propSchema: any): z.ZodType<any> {
  if (!propSchema || typeof propSchema !== 'object') {
    return z.any();
  }

  const type = propSchema.type;

  switch (type) {
    case 'string':
      let stringSchema = z.string();
      if (propSchema.description) {
        stringSchema = stringSchema.describe(propSchema.description);
      }
      if (propSchema.minLength !== undefined) {
        stringSchema = stringSchema.min(propSchema.minLength);
      }
      if (propSchema.maxLength !== undefined) {
        stringSchema = stringSchema.max(propSchema.maxLength);
      }
      if (propSchema.pattern) {
        stringSchema = stringSchema.regex(new RegExp(propSchema.pattern));
      }
      if (propSchema.enum) {
        return z.enum(propSchema.enum as [string, ...string[]]);
      }
      return stringSchema;

    case 'number':
    case 'integer':
      let numberSchema = type === 'integer' ? z.number().int() : z.number();
      if (propSchema.description) {
        numberSchema = numberSchema.describe(propSchema.description);
      }
      if (propSchema.minimum !== undefined) {
        numberSchema = numberSchema.min(propSchema.minimum);
      }
      if (propSchema.maximum !== undefined) {
        numberSchema = numberSchema.max(propSchema.maximum);
      }
      return numberSchema;

    case 'boolean':
      let boolSchema = z.boolean();
      if (propSchema.description) {
        boolSchema = boolSchema.describe(propSchema.description);
      }
      return boolSchema;

    case 'array':
      let arraySchema = z.array(
        propSchema.items
          ? jsonSchemaPropertyToZod(propSchema.items)
          : z.any()
      );
      if (propSchema.description) {
        arraySchema = arraySchema.describe(propSchema.description);
      }
      if (propSchema.minItems !== undefined) {
        arraySchema = arraySchema.min(propSchema.minItems);
      }
      if (propSchema.maxItems !== undefined) {
        arraySchema = arraySchema.max(propSchema.maxItems);
      }
      return arraySchema;

    case 'object':
      if (propSchema.properties && typeof propSchema.properties === 'object') {
        const shape: Record<string, z.ZodType<any>> = {};
        for (const [key, value] of Object.entries(propSchema.properties)) {
          shape[key] = jsonSchemaPropertyToZod(value);
        }
        let objSchema = z.object(shape);
        if (propSchema.description) {
          objSchema = objSchema.describe(propSchema.description);
        }
        return objSchema;
      }
      return z.record(z.any());

    case 'null':
      return z.null();

    default:
      return z.any();
  }
}

/**
 * Convert JSON Schema to Zod schema for AI SDKs that use Zod
 * Handles edge cases like missing schemas, type: "None", or invalid types
 * Always returns a valid Zod object schema
 * @internal
 */
export function jsonSchemaToZod(schema: any): z.ZodObject<any> {
  // Handle missing, null, or invalid schemas
  if (!schema || typeof schema !== 'object') {
    return z.object({});
  }

  // Handle type: "None", null, or undefined
  if (schema.type === 'None' || schema.type === null || schema.type === undefined) {
    // If there are properties, convert them
    if (schema.properties && typeof schema.properties === 'object') {
      const shape: Record<string, z.ZodType<any>> = {};
      const required = schema.required || [];

      for (const [key, value] of Object.entries(schema.properties)) {
        let propSchema = jsonSchemaPropertyToZod(value);
        // Make optional if not in required array
        if (!required.includes(key)) {
          propSchema = propSchema.optional();
        }
        shape[key] = propSchema;
      }

      return z.object(shape);
    }
    // No properties, return empty object
    return z.object({});
  }

  // Ensure type is "object"
  if (schema.type !== 'object') {
    return z.object({});
  }

  // Valid object schema - convert properties
  if (schema.properties && typeof schema.properties === 'object') {
    const shape: Record<string, z.ZodType<any>> = {};
    const required = schema.required || [];

    for (const [key, value] of Object.entries(schema.properties)) {
      let propSchema = jsonSchemaPropertyToZod(value);
      // Make optional if not in required array
      if (!required.includes(key)) {
        propSchema = propSchema.optional();
      }
      shape[key] = propSchema;
    }

    return z.object(shape);
  }

  // Object type with no properties
  return z.object({});
}

/**
 * Execute a tool with provider token injection
 * Temporarily sets the Authorization header for the tool call
 * @internal
 */
export async function executeToolWithToken(
  client: MCPClient<any>,
  toolName: string,
  args: Record<string, unknown>,
  options?: AIToolsOptions
): Promise<any> {
  // If provider tokens are provided, inject the appropriate token
  if (options?.providerTokens) {
    const provider = getProviderForTool(client, toolName);
    if (provider && options.providerTokens[provider]) {
      // Get the transport from the client and set the Authorization header
      const transport = (client as any).transport;
      if (transport && typeof transport.setHeader === 'function') {
        const previousAuthHeader = transport.headers?.['Authorization'];

        try {
          // Set the authorization header for this tool call
          transport.setHeader('Authorization', `Bearer ${options.providerTokens[provider]}`);

          // Execute the tool with the injected token
          const result = await client._callToolByName(toolName, args);
          return result;
        } finally {
          // Clean up: restore previous auth header or remove it
          if (previousAuthHeader) {
            transport.setHeader('Authorization', previousAuthHeader);
          } else if (transport.removeHeader) {
            transport.removeHeader('Authorization');
          }
        }
      }
    }
  }

  // No token injection needed or not available - execute normally
  const result = await client._callToolByName(toolName, args);
  return result;
}

/**
 * Auto-connect client if needed
 * @internal
 */
export async function ensureClientConnected(client: MCPClient<any>): Promise<void> {
  if (!client.isConnected()) {
    await client.connect();
  }
}

