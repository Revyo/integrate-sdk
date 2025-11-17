/**
 * Google GenAI Integration
 * 
 * Helper functions to convert MCP tools to Google GenAI format
 */

import type { MCPClient } from "../client.js";
import type { MCPTool } from "../protocol/messages.js";
import { executeToolWithToken, ensureClientConnected, getProviderTokens, type AIToolsOptions } from "./utils.js";

// Import and re-export types from @google/genai
// These will match exactly what the @google/genai SDK expects
import { Type } from "@google/genai";
import type {
  Schema,
  FunctionDeclaration,
  FunctionCall
} from "@google/genai";

// Export with aliases for convenience
export type GoogleTool = FunctionDeclaration;
export type GoogleFunctionCall = FunctionCall;
export type { Schema, Type };

/**
 * Options for converting MCP tools to Google GenAI format
 */
export interface GoogleToolsOptions extends AIToolsOptions { }

/**
 * Convert JSON Schema type string to Google GenAI Type enum
 */
function convertJsonSchemaTypeToGoogleType(type: string): Type {
  const typeMap: Record<string, Type> = {
    'string': Type.STRING,
    'number': Type.NUMBER,
    'integer': Type.INTEGER,
    'boolean': Type.BOOLEAN,
    'array': Type.ARRAY,
    'object': Type.OBJECT,
  };
  return typeMap[type.toLowerCase()] || Type.STRING;
}

/**
 * Convert properties to Schema format recursively
 */
function convertPropertiesToSchema(properties: Record<string, any>): Record<string, Schema> {
  const result: Record<string, Schema> = {};
  
  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== 'object') {
      result[key] = value as Schema;
      continue;
    }
    
    const schema: Schema = {
      description: value.description,
      enum: value.enum,
    };
    
    // Convert type string to Type enum
    if (value.type) {
      schema.type = convertJsonSchemaTypeToGoogleType(value.type);
    }
    
    if (value.items) {
      schema.items = convertPropertiesToSchema({ items: value.items }).items;
    }
    
    if (value.properties) {
      schema.properties = convertPropertiesToSchema(value.properties);
    }
    
    // Copy other properties
    for (const [k, v] of Object.entries(value)) {
      if (!['type', 'description', 'enum', 'items', 'properties'].includes(k)) {
        (schema as any)[k] = v;
      }
    }
    
    result[key] = schema;
  }
  
  return result;
}

/**
 * Convert a single MCP tool to Google GenAI format
 * 
 * @param mcpTool - The MCP tool definition
 * @param client - The MCP client instance (used for executing the tool)
 * @param options - Optional configuration including provider tokens
 * @returns Google GenAI compatible tool definition
 * 
 * @example
 * ```typescript
 * const googleTool = convertMCPToolToGoogle(mcpTool, client);
 * ```
 */
export function convertMCPToolToGoogle(
  mcpTool: MCPTool,
  _client: MCPClient<any>,
  _options?: GoogleToolsOptions
): GoogleTool {
  const properties = mcpTool.inputSchema?.properties || {};
  const convertedProperties = convertPropertiesToSchema(properties);
  
  const parameters: Schema = {
    type: Type.OBJECT,
    description: mcpTool.description || '',
    properties: convertedProperties,
  };
  
  // Add required fields if present
  if (mcpTool.inputSchema?.required && mcpTool.inputSchema.required.length > 0) {
    (parameters as any).required = mcpTool.inputSchema.required;
  }
  
  return {
    name: mcpTool.name,
    description: mcpTool.description || `Execute ${mcpTool.name}`,
    parameters,
  };
}

/**
 * Convert all enabled MCP tools to Google GenAI format
 * 
 * @param client - The MCP client instance (must be connected)
 * @param options - Optional configuration including provider tokens
 * @returns Array of Google GenAI compatible tool definitions
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * const tools = convertMCPToolsToGoogle(mcpClient);
 * 
 * // Server-side with provider tokens
 * const tools = convertMCPToolsToGoogle(serverClient, {
 *   providerTokens: { github: 'ghp_...', gmail: 'ya29...' }
 * });
 * ```
 */
export function convertMCPToolsToGoogle(
  client: MCPClient<any>,
  options?: GoogleToolsOptions
): GoogleTool[] {
  const mcpTools = client.getEnabledTools();
  return mcpTools.map(mcpTool => convertMCPToolToGoogle(mcpTool, client, options));
}

/**
 * Execute a function call from Google GenAI
 * 
 * Automatically extracts provider tokens from the request if not provided.
 * 
 * @param client - The MCP client instance
 * @param functionCall - The function call from Google GenAI response
 * @param options - Optional configuration including provider tokens
 * @returns Tool execution result as JSON string
 * 
 * @example
 * ```typescript
 * // Tokens are automatically extracted
 * const result = await executeGoogleFunctionCall(client, {
 *   name: 'github_create_issue',
 *   args: { owner: 'user', repo: 'repo', title: 'Bug' }
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Or explicitly pass provider tokens
 * const result = await executeGoogleFunctionCall(client, {
 *   name: 'github_create_issue',
 *   args: { owner: 'user', repo: 'repo', title: 'Bug' }
 * }, { providerTokens });
 * ```
 */
export async function executeGoogleFunctionCall(
  client: MCPClient<any>,
  functionCall: GoogleFunctionCall,
  options?: GoogleToolsOptions
): Promise<string> {
  if (!functionCall?.name) {
    throw new Error('Function call must have a name');
  }
  
  // Auto-extract tokens if not provided
  let providerTokens = options?.providerTokens;
  if (!providerTokens) {
    try {
      providerTokens = await getProviderTokens();
    } catch {
      // Token extraction failed - that's okay
    }
  }

  const finalOptions = providerTokens ? { ...options, providerTokens } : options;
  
  // Extract args - the actual GoogleFunctionCall type has args as a property
  const args = (functionCall as any).args || {};
  
  const result = await executeToolWithToken(
    client, 
    functionCall.name, 
    args, 
    finalOptions
  );
  return JSON.stringify(result);
}

/**
 * Execute multiple function calls from Google GenAI response
 * 
 * This function handles the transformation from Google's function call format
 * to the format expected by the SDK, then executes each call.
 * 
 * Automatically extracts provider tokens from the request if not provided.
 * 
 * @param client - The MCP client instance
 * @param functionCalls - Array of function calls from Google GenAI response
 * @param options - Optional configuration including provider tokens
 * @returns Array of execution results
 * 
 * @example
 * ```typescript
 * // In your API route - tokens are automatically extracted
 * const response = await ai.models.generateContent({
 *   model: 'gemini-2.0-flash-001',
 *   contents: messages,
 *   config: {
 *     tools: [{ functionDeclarations: await getGoogleTools(serverClient) }],
 *   },
 * });
 * 
 * if (response.functionCalls && response.functionCalls.length > 0) {
 *   const results = await executeGoogleFunctionCalls(
 *     serverClient, 
 *     response.functionCalls
 *   );
 *   return Response.json(results);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Or explicitly pass provider tokens
 * const results = await executeGoogleFunctionCalls(
 *   serverClient, 
 *   response.functionCalls,
 *   { providerTokens }
 * );
 * ```
 */
export async function executeGoogleFunctionCalls(
  client: MCPClient<any>,
  functionCalls: GoogleFunctionCall[] | undefined | null,
  options?: GoogleToolsOptions
): Promise<string[]> {
  if (!functionCalls || functionCalls.length === 0) {
    return [];
  }
  
  // Auto-extract tokens if not provided
  let providerTokens = options?.providerTokens;
  if (!providerTokens) {
    try {
      providerTokens = await getProviderTokens();
    } catch {
      // Token extraction failed - that's okay
    }
  }

  const finalOptions = providerTokens ? { ...options, providerTokens } : options;
  
  const results = await Promise.all(
    functionCalls.map(call => executeGoogleFunctionCall(client, call, finalOptions))
  );
  
  return results;
}

/**
 * Get tools in a format compatible with Google GenAI
 * 
 * Automatically connects the client if not already connected.
 * 
 * @param client - The MCP client instance
 * @param options - Optional configuration including provider tokens for server-side usage
 * @returns Array of tools ready to use with Google GenAI
 * 
 * @example
 * ```typescript
 * // Client-side usage
 * import { createMCPClient, githubIntegration } from 'integrate-sdk';
 * import { getGoogleTools } from 'integrate-sdk/ai/google';
 * import { genai } from '@google/genai';
 * 
 * const client = createMCPClient({
 *   integrations: [githubIntegration({ clientId: '...' })],
 * });
 * 
 * const tools = await getGoogleTools(client);
 * const ai = genai({ apiKey: 'YOUR_API_KEY' });
 * 
 * const response = await ai.models.generateContent({
 *   model: 'gemini-2.0-flash-001',
 *   contents: messages,
 *   config: {
 *     tools: [{ functionDeclarations: tools }]
 *   }
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Server-side usage with tokens from client
 * import { createMCPServer, githubIntegration } from 'integrate-sdk/server';
 * import { getGoogleTools, executeGoogleFunctionCalls } from 'integrate-sdk/ai/google';
 * import { genai } from '@google/genai';
 * 
 * const { client: serverClient } = createMCPServer({
 *   integrations: [githubIntegration({ 
 *     clientId: '...', 
 *     clientSecret: '...' 
 *   })],
 * });
 * 
 * // In your API route
 * export async function POST(req: Request) {
 *   const providerTokens = JSON.parse(req.headers.get('x-integrate-tokens') || '{}');
 *   const tools = await getGoogleTools(serverClient, { providerTokens });
 *   
 *   const ai = genai({ apiKey: process.env.GOOGLE_API_KEY });
 *   const response = await ai.models.generateContent({
 *     model: 'gemini-2.0-flash-001',
 *     contents: messages,
 *     config: {
 *       tools: [{ functionDeclarations: tools }]
 *     }
 *   });
 *   
 *   // Handle function calls if any
 *   if (response.functionCalls && response.functionCalls.length > 0) {
 *     const results = await executeGoogleFunctionCalls(
 *       serverClient, 
 *       response.functionCalls,
 *       { providerTokens }
 *     );
 *     return Response.json(results);
 *   }
 *   
 *   return Response.json(response);
 * }
 * ```
 */
export async function getGoogleTools(
  client: MCPClient<any>,
  options?: GoogleToolsOptions
): Promise<GoogleTool[]> {
  await ensureClientConnected(client);

  // Auto-extract tokens if not provided
  let providerTokens = options?.providerTokens;
  if (!providerTokens) {
    try {
      providerTokens = await getProviderTokens();
    } catch {
      // Token extraction failed - that's okay
    }
  }

  const finalOptions = providerTokens ? { ...options, providerTokens } : options;
  return convertMCPToolsToGoogle(client, finalOptions);
}

