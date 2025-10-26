# Integrate SDK

[![Tests](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml/badge.svg)](https://github.com/Revyo/integrate-sdk/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/integrate-sdk.svg)](https://www.npmjs.com/package/integrate-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A type-safe TypeScript SDK for connecting to the Integrate MCP (Model Context Protocol) server. Access GitHub, Gmail, Notion, and other integrations through a simple, plugin-based API.

**📚 [Full Documentation](https://integrate.dev)** | **Server:** `https://mcp.integrate.dev/api/v1/mcp`

## Features

- 🔌 **Plugin-Based Architecture** - Enable only the integrations you need
- 🔒 **Type-Safe** - Full TypeScript support with IntelliSense
- 🌊 **Real-time Communication** - HTTP streaming with NDJSON
- 🔐 **OAuth Ready** - Configure OAuth credentials for each provider
- 🛠️ **Extensible** - Create custom plugins for new integrations
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

// Call a tool
const result = await client.callTool("github_create_issue", {
  repo: "owner/repo",
  title: "Bug report",
  body: "Description of the bug",
});

console.log("Issue created:", result);

// Disconnect when done
await client.disconnect();
```

**Need help?** Check out the [complete documentation](https://integrate.dev) for detailed guides, examples, and API reference.

## Built-in Plugins

### GitHub Plugin

Access GitHub repositories, issues, pull requests, and more.

```typescript
githubPlugin({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  scopes: ["repo", "user"],
});
```

[→ View GitHub plugin documentation](https://integrate.dev/docs/plugins/github)

### Gmail Plugin

Send emails, manage labels, and search messages.

```typescript
gmailPlugin({
  clientId: process.env.GMAIL_CLIENT_ID!,
  clientSecret: process.env.GMAIL_CLIENT_SECRET!,
});
```

[→ View Gmail plugin documentation](https://integrate.dev/docs/plugins/gmail)

### Custom Plugins

Create your own plugins for any service.

```typescript
import { genericOAuthPlugin } from "integrate-sdk";

const slackPlugin = genericOAuthPlugin({
  id: "slack",
  provider: "slack",
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  scopes: ["chat:write", "channels:read"],
  tools: ["slack_send_message", "slack_list_channels"],
});
```

[→ Learn how to create custom plugins](https://integrate.dev/docs/plugins/custom-plugins)

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
  model: openai("gpt-4"),
  prompt: "Create a GitHub issue about the login bug",
  tools,
  maxToolRoundtrips: 5,
});
```

[→ View Vercel AI SDK integration guide](https://integrate.dev/docs/integrations/vercel-ai)

## Documentation

For detailed guides, API reference, and examples, visit the [complete documentation](https://integrate.dev):

- **[Getting Started](https://integrate.dev/docs/getting-started/installation)** - Installation and quick start
- **[Plugins](https://integrate.dev/docs/plugins)** - Built-in and custom plugins
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
