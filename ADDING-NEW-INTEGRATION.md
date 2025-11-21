# Adding a New Integration to Integrate SDK

This guide walks you through the complete process of adding a new integration to the Integrate SDK.

## Overview

An integration consists of:
1. Integration definition file (`src/integrations/your-integration.ts`)
2. Client types file (`src/integrations/your-integration-client.ts`)
3. Type system updates (`src/client.ts`)
4. Export declarations (`src/index.ts`, `src/server.ts`)
5. Optional: Add to default client (`index.ts`)

## Step 1: Create the Integration File

**File:** `src/integrations/your-integration.ts`

```typescript
import type { MCPIntegration, OAuthConfig } from "./types.js";
import { getEnv } from "../utils/env.js";

/**
 * Your Integration Configuration
 * 
 * SERVER-SIDE: Automatically reads YOUR_PROVIDER_CLIENT_ID and YOUR_PROVIDER_CLIENT_SECRET from environment.
 * You can override by providing explicit clientId and clientSecret values.
 * CLIENT-SIDE: Omit clientId and clientSecret when using createMCPClient()
 */
export interface YourIntegrationConfig {
  /** OAuth client ID (defaults to YOUR_PROVIDER_CLIENT_ID env var) */
  clientId?: string;
  /** OAuth client secret (defaults to YOUR_PROVIDER_CLIENT_SECRET env var) */
  clientSecret?: string;
  /** OAuth scopes */
  scopes?: string[];
  /** OAuth redirect URI (optional - auto-detected from environment) */
  redirectUri?: string;
  // Add any provider-specific options here
}

/**
 * Default tools that this integration enables
 * These should match the tool names exposed by your MCP server
 */
const YOUR_TOOLS = [
  "your_tool_name_1",
  "your_tool_name_2",
] as const;

/**
 * Your Integration
 * 
 * Enables your integration with OAuth authentication.
 * 
 * By default, reads YOUR_PROVIDER_CLIENT_ID and YOUR_PROVIDER_CLIENT_SECRET from environment variables.
 * You can override these by providing explicit values in the config.
 * 
 * @example Server-side (minimal - uses env vars):
 * ```typescript
 * import { createMCPServer, yourIntegration } from 'integrate-sdk/server';
 * 
 * // Automatically uses YOUR_PROVIDER_CLIENT_ID and YOUR_PROVIDER_CLIENT_SECRET from env
 * export const { client } = createMCPServer({
 *   integrations: [
 *     yourIntegration({
 *       scopes: ['scope1', 'scope2'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Server-side (with explicit override):
 * ```typescript
 * import { createMCPServer, yourIntegration } from 'integrate-sdk/server';
 * 
 * export const { client } = createMCPServer({
 *   integrations: [
 *     yourIntegration({
 *       clientId: process.env.CUSTOM_CLIENT_ID!,
 *       clientSecret: process.env.CUSTOM_CLIENT_SECRET!,
 *       scopes: ['scope1', 'scope2'],
 *     }),
 *   ],
 * });
 * ```
 * 
 * @example Client-side (without secrets):
 * ```typescript
 * import { createMCPClient, yourIntegration } from 'integrate-sdk';
 * 
 * const client = createMCPClient({
 *   integrations: [
 *     yourIntegration({
 *       scopes: ['scope1', 'scope2'],
 *     }),
 *   ],
 * });
 * ```
 */
export function yourIntegration(config: YourIntegrationConfig = {}): MCPIntegration<"your-provider"> {
  const oauth: OAuthConfig = {
    provider: "your-provider",
    clientId: config.clientId ?? getEnv('YOUR_PROVIDER_CLIENT_ID'),
    clientSecret: config.clientSecret ?? getEnv('YOUR_PROVIDER_CLIENT_SECRET'),
    scopes: config.scopes || ["default", "scopes"],
    redirectUri: config.redirectUri,
    config: {
      // Add any provider-specific config here
      // Example for custom OAuth endpoints (like Notion):
      // authorization_endpoint: 'https://api.example.com/oauth/authorize',
      // token_endpoint: 'https://api.example.com/oauth/token',
      ...config,
    },
  };

  return {
    id: "your-provider",
    tools: [...YOUR_TOOLS],
    oauth,

    async onInit(_client) {
      console.log("Your integration initialized");
    },

    async onAfterConnect(_client) {
      console.log("Your integration connected");
    },
  };
}

/**
 * Export tool names for type inference
 */
export type YourTools = typeof YOUR_TOOLS[number];

/**
 * Export client types
 */
export type { YourIntegrationClient } from "./your-integration-client.js";
```

## Step 2: Create the Client Types File

**File:** `src/integrations/your-integration-client.ts`

```typescript
/**
 * Your Integration Client Types
 * Fully typed interface for your integration methods
 */

import type { MCPToolCallResponse } from "../protocol/messages.js";

/**
 * Your Integration Client Interface
 * Provides type-safe methods for all operations
 */
export interface YourIntegrationClient {
  /**
   * Description of what this method does
   * 
   * @example
   * ```typescript
   * const result = await client.yourProvider.yourMethod({
   *   param1: "value",
   *   param2: 123
   * });
   * ```
   */
  yourMethod(params: {
    /** Description of param1 */
    param1: string;
    /** Description of param2 (optional) */
    param2?: number;
  }): Promise<MCPToolCallResponse>;

  /**
   * Another method
   */
  anotherMethod(params: {
    id: string;
  }): Promise<MCPToolCallResponse>;
}
```

## Step 3: Update Client Types

**File:** `src/client.ts`

### 3.1: Add Import

Find the imports at the top of the file (around line 25) and add:

```typescript
import type { YourIntegrationClient } from "./integrations/your-integration-client.js";
```

### 3.2: Update IntegrationNamespaces Type

Find the `IntegrationNamespaces` type (around line 121) and add your integration:

```typescript
type IntegrationNamespaces<TIntegrations extends readonly MCPIntegration[]> = {
  [K in IntegrationIds<TIntegrations> as K extends "github" 
    ? "github" 
    : K extends "gmail" 
    ? "gmail"
    : K extends "notion"
    ? "notion"
    : K extends "your-provider"        // ADD THIS LINE
    ? "your-provider"                   // ADD THIS LINE
    : never]: 
      K extends "github" ? GitHubIntegrationClient :
      K extends "gmail" ? GmailIntegrationClient :
      K extends "notion" ? NotionIntegrationClient :
      K extends "your-provider" ? YourIntegrationClient :  // ADD THIS LINE
      never;
};
```

## Step 4: Export from Main Index

**File:** `src/index.ts`

Find the built-in integrations exports (around line 88) and add:

```typescript
export { yourIntegration } from "./integrations/your-integration.js";
export type { YourIntegrationConfig, YourTools, YourIntegrationClient } from "./integrations/your-integration.js";
```

## Step 5: Export from Server Index

**File:** `src/server.ts`

Find the integration exports (around line 457) and add:

```typescript
export { yourIntegration } from './integrations/your-integration.js';
```

## Step 6: Add to Default Client (Optional)

**File:** `index.ts`

If you want your integration included in the default client export, add it:

### 6.1: Add Import

```typescript
import { yourIntegration } from './src/integrations/your-integration.js';
```

### 6.2: Add to Default Client

```typescript
export const client = createMCPClient({
  integrations: [
    githubIntegration(),
    gmailIntegration(),
    notionIntegration(),
    yourIntegration(),  // ADD THIS
  ],
});
```

## Step 7: Add Tests

**File:** `tests/integrations/integration-system.test.ts`

Add test cases for your integration:

```typescript
import { yourIntegration } from "../../src/integrations/your-integration.js";

describe("Your Integration", () => {
  test("creates integration with correct structure", () => {
    const integration = yourIntegration({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    });

    expect(integration.id).toBe("your-provider");
    expect(integration.tools).toBeArray();
    expect(integration.tools.length).toBeGreaterThan(0);
    expect(integration.oauth).toBeDefined();
  });

  test("includes OAuth configuration", () => {
    const integration = yourIntegration({
      clientId: "test-id",
      clientSecret: "test-secret",
      scopes: ["scope1", "scope2"],
    });

    expect(integration.oauth?.provider).toBe("your-provider");
    expect(integration.oauth?.clientId).toBe("test-id");
    expect(integration.oauth?.clientSecret).toBe("test-secret");
    expect(integration.oauth?.scopes).toEqual(["scope1", "scope2"]);
  });

  test("includes expected tools", () => {
    const integration = yourIntegration({
      clientId: "test-id",
      clientSecret: "test-secret",
    });

    expect(integration.tools).toContain("your_tool_name_1");
    expect(integration.tools).toContain("your_tool_name_2");
  });

  test("has lifecycle hooks defined", () => {
    const integration = yourIntegration({
      clientId: "test-id",
      clientSecret: "test-secret",
    });

    expect(integration.onInit).toBeDefined();
    expect(integration.onAfterConnect).toBeDefined();
  });
});
```

## Usage in Your Application

### Server-Side Setup

**File:** `lib/integrate-server.ts` (or similar)

```typescript
import { createMCPServer, yourIntegration } from 'integrate-sdk/server';

export const { client: serverClient } = createMCPServer({
  apiKey: process.env.INTEGRATE_API_KEY,
  serverUrl: "http://localhost:8080/api/v1/mcp",
  integrations: [
    yourIntegration({
      clientId: process.env.YOUR_PROVIDER_CLIENT_ID,
      clientSecret: process.env.YOUR_PROVIDER_CLIENT_SECRET,
      scopes: ['scope1', 'scope2'],
    }),
  ],
  // ... your other config (getSessionContext, setProviderToken, etc.)
});
```

### Client-Side Setup

```typescript
import { client } from 'integrate-sdk';
// Or create a custom client:
// import { createMCPClient, yourIntegration } from 'integrate-sdk';

// Authorize the provider
await client.authorize('your-provider');

// Use the integration
const result = await client.yourProvider.yourMethod({ 
  param1: 'value',
  param2: 123
});
```

## Special Cases

### Custom OAuth Endpoints (like Notion)

If your provider uses custom OAuth endpoints instead of the standard OAuth flow:

```typescript
config: {
  authorization_endpoint: 'https://api.example.com/oauth/authorize',
  token_endpoint: 'https://api.example.com/oauth/token',
  // Use snake_case, not camelCase!
  ...config,
},
```

### No OAuth Scopes (like Notion)

If your provider doesn't use traditional OAuth scopes:

```typescript
scopes: [], // Empty array
```

### Provider-Specific Parameters (like Notion's 'owner')

Add custom parameters to the config:

```typescript
config: {
  owner: config.owner || 'user',
  // ... other custom parameters
  ...config,
},
```

## Checklist

- [ ] Created `src/integrations/your-integration.ts`
- [ ] Created `src/integrations/your-integration-client.ts`
- [ ] Updated `src/client.ts` (import + IntegrationNamespaces)
- [ ] Updated `src/index.ts` (exports)
- [ ] Updated `src/server.ts` (exports)
- [ ] Updated `index.ts` (optional - default client)
- [ ] Added tests in `tests/integrations/integration-system.test.ts`
- [ ] Set environment variables (`YOUR_PROVIDER_CLIENT_ID`, `YOUR_PROVIDER_CLIENT_SECRET`)
- [ ] Built and tested the integration

## Environment Variables

Make sure to set these in your `.env` file:

```bash
YOUR_PROVIDER_CLIENT_ID=your_client_id_here
YOUR_PROVIDER_CLIENT_SECRET=your_client_secret_here
```

## Troubleshooting

### "No OAuth configuration found for provider: your-provider"

**Causes:**
1. Integration not included in the `integrations` array in `createMCPServer()` (server-side)
2. Integration not included in default client or custom client (client-side)
3. Provider name mismatch between integration `id` and `oauth.provider`

**Solution:** Ensure the integration is added to both server and client configurations.

### "Missing OAuth credentials"

**Causes:**
1. Environment variables not set
2. Variable names don't match the pattern in `getEnv()` call

**Solution:** Check your `.env` file and ensure variable names match exactly.

### Type Errors

**Causes:**
1. Forgot to update `IntegrationNamespaces` in `src/client.ts`
2. Forgot to add type import in `src/client.ts`

**Solution:** Follow Step 3 carefully to update all type definitions.

