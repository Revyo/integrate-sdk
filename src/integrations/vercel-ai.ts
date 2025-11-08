/**
 * Vercel AI SDK Integration
 * 
 * Helper functions to convert MCP tools to Vercel AI SDK v5 format
 */

import { z } from "zod";
import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";

/**
 * Tool definition compatible with Vercel AI SDK v5
 * This matches the CoreTool interface from 'ai' package v5
 */
export interface VercelAITool {
  description?: string;
  inputSchema: z.ZodType<any>; // Zod schema for tool parameters
  execute: (args: any, options?: any) => Promise<any>;
}

/**
 * Options for converting MCP tools to Vercel AI SDK format
 */
export interface VercelAIToolsOptions {
  /**
   * Provider tokens for server-side usage
   * Maps provider names (e.g., 'github', 'gmail') to their access tokens
   * 
   * @example
   * ```typescript
   * const tools = getVercelAITools(serverClient, {
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
function getProviderForTool(client: MCPClient<any>, toolName: string): string | undefined {
  // Access the client's method to get provider for tool
  // This uses the internal method but it's safe since we're in the same SDK
  return (client as any).getProviderForTool?.(toolName);
}

/**
 * Convert a JSON Schema property to a Zod schema
 * @internal
 */
function jsonSchemaPropertyToZod(propSchema: any): z.ZodType<any> {
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
 * Convert JSON Schema to Zod schema for Vercel AI SDK v5
 * Handles edge cases like missing schemas, type: "None", or invalid types
 * Always returns a valid Zod object schema
 * @internal
 */
function jsonSchemaToZod(schema: any): z.ZodObject<any> {
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
 * Convert a single MCP tool to Vercel AI SDK format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Vercel AI SDK compatible tool definition
 */
export function convertMCPToolToVercelAI(
  mcpTool: MCPTool,
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
): VercelAITool {
  return {
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    inputSchema: jsonSchemaToZod(mcpTool.inputSchema), // Convert JSON Schema to Zod
    execute: async (args: Record<string, unknown>) => {
      // If provider tokens are provided, inject the appropriate token
      if (options?.providerTokens) {
        const provider = getProviderForTool(client, mcpTool.name);
        if (provider && options.providerTokens[provider]) {
          // Get the transport from the client and set the Authorization header
          const transport = (client as any).transport;
          if (transport && typeof transport.setHeader === 'function') {
            const previousAuthHeader = transport.headers?.['Authorization'];
            
            try {
              // Set the authorization header for this tool call
              transport.setHeader('Authorization', `Bearer ${options.providerTokens[provider]}`);
              
              // Execute the tool with the injected token
              const result = await client._callToolByName(mcpTool.name, args);
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
      
      // Use internal method to call tools by name for integration purposes
      const result = await client._callToolByName(mcpTool.name, args);
      return result;
    },
  };
}

/**
 * Convert all enabled MCP tools to Vercel AI SDK v5 format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Object mapping tool names to Vercel AI SDK v5 tool definitions (compatible with CoreTool from 'ai' package v5)
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubPlugin } from 'integrate-sdk';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * import { generateText } from 'ai';
 * 
 * const mcpClient = createMCPClient({
 *   plugins: [githubPlugin({ clientId: '...', clientSecret: '...' })],
 * });
 * 
 * await mcpClient.connect();
 * 
 * const tools = convertMCPToolsToVercelAI(mcpClient);
 * 
 * const result = await generateText({
 *   model: openai('gpt-5'),
 *   prompt: 'Create a GitHub issue in my repo',
 *   tools,
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with token passing
 * import { createMCPServer, githubPlugin } from 'integrate-sdk/server';
 * import { convertMCPToolsToVercelAI } from 'integrate-sdk/vercel-ai';
 * 
 * const { client: serverClient } = createMCPServer({
 *   plugins: [githubPlugin({ clientId: '...', clientSecret: '...' })],
 * });
 * 
 * // In your API route handler
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   
 *   const tools = convertMCPToolsToVercelAI(serverClient, { providerTokens });
 *   
 *   const result = await generateText({
 *     model: openai('gpt-4'),
 *     prompt: 'Create a GitHub issue',
 *     tools,
 *   });
 *   
 *   return Response.json(result);
 * }
 * ```
 */
export function convertMCPToolsToVercelAI(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
): Record<string, any> {
  const mcpTools = client.getEnabledTools();
  const vercelTools: Record<string, any> = {};
  
  for (const mcpTool of mcpTools) {
    vercelTools[mcpTool.name] = convertMCPToolToVercelAI(mcpTool, client, options);
  }
  
  return vercelTools;
}

/**
 * Get tools in a format compatible with Vercel AI SDK v5's tools parameter
 * 
 * This returns the tools in the exact format expected by ai.generateText() and ai.streamText()
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Tools object ready to pass to generateText({ tools: ... }) or streamText({ tools: ... })
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = await getVercelAITools(mcpClient);
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 * const tools = await getVercelAITools(serverClient, { providerTokens });
 * ```
 */
export async function getVercelAITools(
  client: MCPClient<any>,
  options?: VercelAIToolsOptions
) {
  // Auto-connect if not connected (lazy connection)
  if (!client.isConnected()) {
    await client.connect();
  }
  
  return convertMCPToolsToVercelAI(client, options);
}

