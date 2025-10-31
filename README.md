# Integrate SDK

[![Tests](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/integrate-sdk.svg)](https://www.npmjs.com/package/integrate-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A type-safe TypeScript SDK for connecting to the Integrate MCP (Model Context Protocol) server. Access GitHub, Gmail, Notion, and other integrations through a simple, plugin-based API.

**📚 [Full Documentation](https://integrate.dev)** | **Server:** `https://mcp.integrate.dev/api/v1/mcp`

## Features

- 🔌 **Plugin-Based Architecture** - Enable only the integrations you need
- 🔒 **Fully Typed API** - Type-safe methods with autocomplete (e.g., `client.github.createIssue()`)
- 💡 **IntelliSense Support** - Full TypeScript support with parameter hints
- 🌊 **Real-time Communication** - HTTP streaming with NDJSON
- 🔐 **OAuth Ready** - Configure OAuth credentials for each provider
- 🛠️ **Extensible** - Configure plugins for any server-supported integration
- 📦 **Zero Dependencies** - Lightweight implementation

## Installation

```bash
npm install integrate-sdk
# or
bun add integrate-sdk
```

## Quick Start

```typescript
import { createMCPClient, githubPlugin } from "integrate-sdk";

// Create a client with plugins
const client = createMCPClient({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ["repo", "user"],
    }),
  ],
});

// Connect to the server
await client.connect();

// Call GitHub methods with full type safety
const result = await client.github.createIssue({
  owner: "owner",
  repo: "repo",
  title: "Bug report",
  body: "Description of the bug",
});

console.log("Issue created:", result);

// Call server-level tools with typed methods
const tools = await client.server.listToolsByIntegration({
  integration: "github",
});

// Disconnect when done
await client.disconnect();
```

**Need help?** Check out the [complete documentation](https://integrate.dev) for detailed guides, examples, and API reference.

## Why Use Integrate SDK?

### Typed Plugin Methods

Instead of generic tool calls, use typed methods with full autocomplete:

```typescript
// ✅ New: Typed methods with autocomplete
await client.github.createIssue({ owner: "user", repo: "project", title: "Bug" });
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
await client.github.createIssue({ owner: "user", repo: "project", title: "Bug" });
await client.gmail.sendEmail({ to: "user@example.com", subject: "Hello" });

// 2. Typed server methods (for server-level tools)
await client.server.listToolsByIntegration({ integration: "github" });

// 3. Direct tool calls (for other server-supported integrations)
await client._callToolByName("slack_send_message", { channel: "#general", text: "Hello" });
```

## Built-in Plugins

### GitHub Plugin

Access GitHub repositories, issues, pull requests, and more.

```typescript
const client = createMCPClient({
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ["repo", "user"],
    }),
  ],
});

await client.connect();

// Use typed methods
await client.github.getRepo({ owner: "facebook", repo: "react" });
await client.github.createIssue({ owner: "user", repo: "repo", title: "Bug" });
await client.github.listPullRequests({ owner: "user", repo: "repo", state: "open" });
```

[→ View GitHub plugin documentation](https://integrate.dev/docs/plugins/github)

### Gmail Plugin

Send emails, manage labels, and search messages.

```typescript
const client = createMCPClient({
  plugins: [
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    }),
  ],
});

await client.connect();

// Use typed methods
await client.gmail.sendEmail({ to: "user@example.com", subject: "Hello", body: "Hi!" });
await client.gmail.listEmails({ maxResults: 10, q: "is:unread" });
await client.gmail.searchEmails({ query: "from:notifications@github.com" });
```

[→ View Gmail plugin documentation](https://integrate.dev/docs/plugins/gmail)

### Configure Additional Integrations

The server may support additional integrations beyond GitHub and Gmail. You can configure OAuth and enable these tools using `genericOAuthPlugin`:

```typescript
import { genericOAuthPlugin } from "integrate-sdk";

// Configure a plugin for any server-supported integration
const slackPlugin = genericOAuthPlugin({
  id: "slack",
  provider: "slack",
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  scopes: ["chat:write", "channels:read"],
  tools: ["slack_send_message", "slack_list_channels"], // Must exist on server
});

const client = createMCPClient({
  plugins: [slackPlugin],
});

await client.connect();

// Use _callToolByName to call the tools
await client._callToolByName("slack_send_message", { 
  channel: "#general", 
  text: "Hello!" 
});
```

**Note**: Plugins configure access to server-provided tools - they don't create new tools. All tool implementations must exist on the Integrate MCP server.

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
