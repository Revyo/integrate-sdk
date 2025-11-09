# Integrate SDK

[![Tests](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A type-safe TypeScript SDK for connecting to the Integrate MCP (Model Context Protocol) server. Access GitHub, Gmail, Notion, and other integrations through a simple, plugin-based API.

**📚 [Full Documentation](https://integrate.dev)** | **Server:** `https://mcp.integrate.dev/api/v1/mcp`

## Features

- 🔌 **Plugin-Based Architecture** - Enable only the integrations you need
- 🔒 **Fully Typed API** - Type-safe methods with autocomplete (e.g., `client.github.createIssue()`)
- 💡 **IntelliSense Support** - Full TypeScript support with parameter hints
- ⚡ **Automatic Connection Management** - Lazy connection, auto-cleanup, singleton pattern
- 🔐 **Complete OAuth Flow** - Built-in OAuth 2.0 with PKCE (popup/redirect modes)
- 🌍 **Universal** - Works in browser and Node.js environments
- 🛠️ **Extensible** - Configure plugins for any server-supported integration
- 📦 **Zero Dependencies** - Lightweight implementation

## Installation

```bash
npm install integrate-sdk
# or
bun add integrate-sdk
```

## Quick Start (2 Files Only!)

### 1. Create Server Config

Define your OAuth providers once:

```typescript
// lib/integrate-server.ts (server-side only!)
import {
  createMCPServer,
  githubPlugin,
  gmailPlugin,
} from "integrate-sdk/server";

export const { client: serverClient } = createMCPServer({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scopes: ["repo", "user"],
    }),
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      scopes: ["gmail.readonly"],
    }),
  ],
});
```

### 2. Create Single Catch-All Route

That's it! Just import and export:

```typescript
// app/api/integrate/[...all]/route.ts
import { serverClient } from "@/lib/integrate-server";
import { toNextJsHandler } from "integrate-sdk/server";

export const { POST, GET } = toNextJsHandler({
  client: serverClient,  // Pass the client
  redirectUrl: "/dashboard",
});
```

This imports your config from step 1 and handles ALL OAuth operations (authorize, callback, status, disconnect) in one file!

### 3. Use in Your App

Use the server client in API routes or server components:

```typescript
// app/api/repos/route.ts
import { serverClient } from "@/lib/integrate-server";

export async function GET() {
  // Automatically connects on first call - no manual setup needed!
  const repos = await serverClient.github.listOwnRepos({ per_page: 10 });
  return Response.json({ repos });
}
```

### Client-Side Setup

Use in your client components (no secrets needed):

```typescript
"use client";
import { createMCPClient, githubPlugin } from "integrate-sdk";

const client = createMCPClient({
  plugins: [
    githubPlugin({
      scopes: ["repo", "user"],
      // No clientId or clientSecret needed!
    }),
  ],
  oauthFlow: { mode: "popup" },
});

// Authorize user (opens popup)
await client.authorize("github");

// Use the client - automatically connects!
const result = await client.github.createIssue({
  owner: "owner",
  repo: "repo",
  title: "Bug report",
  body: "Description of the bug",
});

console.log("Issue created:", result);
```

**That's it!** The SDK automatically:

- ✅ Connects on first method call (no manual `connect()` needed)
- ✅ Cleans up on exit (no manual `disconnect()` needed)
- ✅ Manages OAuth tokens securely through your API routes
- ✅ Provides full type safety with autocomplete

### Connection Management

The SDK automatically manages connections for you - no manual `connect()` or `disconnect()` calls needed!

**Features:**

- **Lazy Connection**: Automatically connects on first method call
- **Auto-Cleanup**: Cleans up on process exit
- **Singleton Pattern**: Reuses connections efficiently (configurable)

```typescript
// ✅ Default behavior - automatic connection
const client = createMCPClient({
  plugins: [
    githubPlugin({
      scopes: ["repo", "user"],
    }),
  ],
});

// Use immediately - no connect() needed!
await client.authorize("github");
await client.github.listRepos({ username: "octocat" });

// ✅ Want manual control? Use manual mode
const manualClient = createMCPClient({
  plugins: [githubPlugin({ scopes: ["repo"] })],
  connectionMode: "manual",
  singleton: false,
});

await manualClient.connect();
await manualClient.authorize("github");
await manualClient.github.listRepos({ username: "octocat" });
await manualClient.disconnect();
```

**Need help?** Check out the [complete documentation](https://integrate.dev) for detailed guides, examples, and API reference.

## Browser & Server Support

The SDK works in both environments:

- **Browser**: Use `createMCPClient()` from `'integrate-sdk'` - handles OAuth UI (popup/redirect)
- **Server**: Use `createMCPServer()` from `'integrate-sdk/server'` - includes OAuth secrets for API routes

See [Quick Start](#quick-start) above for complete examples.

## Why Use Integrate SDK?

### Typed Plugin Methods

Instead of generic tool calls, use typed methods with full autocomplete:

```typescript
// ✅ New: Typed methods with autocomplete
await client.github.createIssue({
  owner: "user",
  repo: "project",
  title: "Bug",
});
await client.gmail.sendEmail({ to: "user@example.com", subject: "Hello" });
```

### Benefits

- **Type Safety**: Parameters are validated at compile time
- **Autocomplete**: Your IDE suggests available methods and parameters
- **Documentation**: Inline JSDoc comments for every method
- **Refactoring**: Rename methods safely across your codebase

### Three Ways to Call Tools

```typescript
// 1. Typed plugin methods (recommended for built-in plugins like GitHub/Gmail)
await client.github.createIssue({
  owner: "user",
  repo: "project",
  title: "Bug",
});
await client.gmail.sendEmail({ to: "user@example.com", subject: "Hello" });

// 2. Typed server methods (for server-level tools)
await client.server.listToolsByIntegration({ integration: "github" });

// 3. Direct tool calls (for other server-supported integrations)
await client._callToolByName("slack_send_message", {
  channel: "#general",
  text: "Hello",
});
```

## OAuth Authorization

The SDK implements OAuth 2.0 Authorization Code Flow with PKCE for secure authorization.

**Key Features:**

- ✅ Popup or redirect flow modes
- ✅ Session token management
- ✅ Multiple provider support
- ✅ PKCE security

**Basic Usage:**

```typescript
// Check authorization
if (!(await client.isAuthorized("github"))) {
  await client.authorize("github"); // Opens popup or redirects
}

// Use authorized client
const repos = await client.github.listOwnRepos({});
```

For complete OAuth setup including:

- Popup vs redirect flows
- Session token management
- Multiple providers
- Callback page setup

See the [`/examples`](/examples) directory or [OAuth documentation](https://integrate.dev/docs/guides/oauth-flow).

## Built-in Plugins

### GitHub Plugin

Access GitHub repositories, issues, pull requests, and more with type-safe methods.

```typescript
// Available methods
await client.github.getRepo({ owner: "facebook", repo: "react" });
await client.github.createIssue({ owner: "user", repo: "repo", title: "Bug" });
await client.github.listPullRequests({
  owner: "user",
  repo: "repo",
  state: "open",
});
await client.github.listOwnRepos({});
```

[→ GitHub plugin documentation](https://integrate.dev/docs/plugins/github)

### Gmail Plugin

Send emails, manage labels, and search messages with type-safe methods.

```typescript
// Available methods
await client.gmail.sendEmail({
  to: "user@example.com",
  subject: "Hello",
  body: "Hi!",
});
await client.gmail.listEmails({ maxResults: 10, q: "is:unread" });
await client.gmail.searchEmails({ query: "from:notifications@github.com" });
```

[→ Gmail plugin documentation](https://integrate.dev/docs/plugins/gmail)

### Additional Integrations

Use `genericOAuthPlugin` to configure any server-supported integration:

```typescript
import { genericOAuthPlugin } from "integrate-sdk/server";

const slackPlugin = genericOAuthPlugin({
  id: "slack",
  provider: "slack",
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  scopes: ["chat:write", "channels:read"],
  tools: ["slack_send_message", "slack_list_channels"],
});
```

See [`/examples`](/examples) for complete setup patterns.

## Vercel AI SDK Integration

Give AI models access to all your integrations with built-in Vercel AI SDK support.

```typescript
import { getVercelAITools } from "integrate-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// Convert MCP tools to Vercel AI SDK format
const tools = getVercelAITools(mcpClient);

// Use with AI models
const result = await generateText({
  model: openai("gpt-5"),
  prompt: "Create a GitHub issue about the login bug",
  tools,
  maxToolRoundtrips: 5,
});
```

[→ View Vercel AI SDK integration guide](https://integrate.dev/docs/integrations/vercel-ai)

## Documentation

For detailed guides, API reference, and examples, visit the [complete documentation](https://integrate.dev):

- **[Getting Started](https://integrate.dev/docs/getting-started/installation)** - Installation and quick start
- **[OAuth Flow](https://integrate.dev/docs/guides/oauth-flow)** - OAuth 2.0 authorization guide
- **[Plugins](https://integrate.dev/docs/plugins)** - Built-in plugins and configuration
- **[Vercel AI SDK](https://integrate.dev/docs/integrations/vercel-ai)** - AI model integration
- **[Advanced Usage](https://integrate.dev/docs/guides/advanced-usage)** - Error handling, retries, and more
- **[API Reference](https://integrate.dev/docs/reference/api-reference)** - Complete API documentation
- **[Architecture](https://integrate.dev/docs/reference/architecture)** - How the SDK works

## TypeScript Support

The SDK is built with TypeScript and provides full type safety with IntelliSense support out of the box.

## Contributing

Contributions are welcome! Please check the [issues](https://github.com/Revyo/integrate-sdk/issues) for ways to contribute.

## Testing

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage
```

See the `tests/` directory for unit and integration test examples.

## License

MIT © [Revyo](https://github.com/Revyo)
