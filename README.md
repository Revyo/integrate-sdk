# Integrate SDK

A type-safe TypeScript SDK for building MCP (Model Context Protocol) clients with plugin-based OAuth provider configuration.

## Features

- 🔌 **Plugin-Based Architecture** - Enable only the tools you need with a BetterAuth-inspired plugin pattern
- 🔒 **Type-Safe Configuration** - Full TypeScript support with IntelliSense for tools and configurations
- 🌊 **HTTP Streaming** - Real-time bidirectional communication via HTTP streaming with newline-delimited JSON (NDJSON)
- 🔐 **OAuth Support** - Built-in OAuth configuration for multiple providers
- 🛠️ **Extensible** - Easy to create custom plugins for any OAuth provider or tool set
- 📦 **Zero Dependencies** - Lightweight with no external runtime dependencies

## Installation

```bash
bun add integrate-sdk
```

## Quick Start

```typescript
import { createMCPClient, githubPlugin, gmailPlugin } from 'integrate-sdk';

// Create a client with plugins
const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'user'],
    }),
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    }),
  ],
});

// Connect to the server
await client.connect();

// Call tools
const result = await client.callTool('github/createIssue', {
  repo: 'owner/repo',
  title: 'Bug report',
  body: 'Description of the bug',
});

console.log('Issue created:', result);

// Disconnect when done
await client.disconnect();
```

## Built-in Plugins

### GitHub Plugin

```typescript
import { createMCPClient, githubPlugin } from 'integrate-sdk';

const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scopes: ['repo', 'user', 'read:org'], // Optional, defaults to ['repo', 'user']
      redirectUri: 'http://localhost:3000/callback', // Optional
    }),
  ],
});
```

**Available Tools:**
- `github/createIssue`
- `github/listIssues`
- `github/getIssue`
- `github/updateIssue`
- `github/closeIssue`
- `github/createPullRequest`
- `github/listPullRequests`
- `github/getPullRequest`
- `github/mergePullRequest`
- `github/listRepositories`
- `github/getRepository`
- `github/createRepository`
- And more...

### Gmail Plugin

```typescript
import { createMCPClient, gmailPlugin } from 'integrate-sdk';

const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [
    gmailPlugin({
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      scopes: [ // Optional, defaults to common Gmail scopes
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    }),
  ],
});
```

**Available Tools:**
- `gmail/sendEmail`
- `gmail/listEmails`
- `gmail/getEmail`
- `gmail/deleteEmail`
- `gmail/searchEmails`
- `gmail/markAsRead`
- `gmail/markAsUnread`
- `gmail/listLabels`
- `gmail/createLabel`
- And more...

## Creating Custom Plugins

### Using Generic OAuth Plugin

```typescript
import { createMCPClient, genericOAuthPlugin } from 'integrate-sdk';

const slackPlugin = genericOAuthPlugin({
  id: 'slack',
  provider: 'slack',
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  scopes: ['chat:write', 'channels:read', 'users:read'],
  tools: [
    'slack/sendMessage',
    'slack/listChannels',
    'slack/getChannel',
    'slack/inviteUser',
  ],
  redirectUri: 'http://localhost:3000/callback',
});

const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [slackPlugin],
});
```

### Creating a Simple Plugin (No OAuth)

For tools that don't require OAuth:

```typescript
import { createSimplePlugin } from 'integrate-sdk';

const mathPlugin = createSimplePlugin({
  id: 'math',
  tools: ['math/add', 'math/subtract', 'math/multiply', 'math/divide'],
  onInit: async (client) => {
    console.log('Math plugin initialized');
  },
});
```

### Creating a Custom Plugin from Scratch

```typescript
import type { MCPPlugin } from 'integrate-sdk';

export function customPlugin(config: CustomConfig): MCPPlugin {
  return {
    id: 'custom',
    tools: ['custom/tool1', 'custom/tool2'],
    oauth: {
      provider: 'custom-provider',
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scopes: config.scopes,
    },
    
    async onInit(client) {
      // Called when plugin is initialized
      console.log('Custom plugin initialized');
    },
    
    async onBeforeConnect(client) {
      // Called before connecting to server
    },
    
    async onAfterConnect(client) {
      // Called after successful connection
    },
    
    async onDisconnect(client) {
      // Called when disconnecting
    },
  };
}
```

## Advanced Usage

### Accessing OAuth Configurations

```typescript
// Get OAuth config for a specific plugin
const githubOAuth = client.getOAuthConfig('github');
console.log('GitHub OAuth scopes:', githubOAuth?.scopes);

// Get all OAuth configs
const allConfigs = client.getAllOAuthConfigs();
for (const [pluginId, config] of allConfigs) {
  console.log(`${pluginId}: ${config.provider}`);
}
```

### Listing Available Tools

```typescript
await client.connect();

// Get all enabled tools (filtered by plugins)
const enabledTools = client.getEnabledTools();
console.log('Enabled tools:', enabledTools.map(t => t.name));

// Get all available tools from server
const allTools = client.getAvailableTools();
console.log('All tools:', allTools.map(t => t.name));

// Get a specific tool
const tool = client.getTool('github/createIssue');
console.log('Tool schema:', tool?.inputSchema);
```

### Handling Messages and Notifications

```typescript
// Listen for server messages and notifications
const unsubscribe = client.onMessage((message) => {
  console.log('Received message:', message);
});

// Unsubscribe when done
unsubscribe();
```

### Error Handling

```typescript
try {
  await client.connect();
  const result = await client.callTool('github/createIssue', {
    repo: 'owner/repo',
    title: 'Bug report',
  });
} catch (error) {
  if (error.message.includes('not enabled')) {
    console.error('Tool is not enabled. Add the appropriate plugin.');
  } else if (error.message.includes('not available')) {
    console.error('Tool is not available on the server.');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Custom Headers and Timeouts

```typescript
const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [/* ... */],
  
  // Custom headers
  headers: {
    'Authorization': 'Bearer token',
    'X-Custom-Header': 'value',
  },
  
  // Request timeout (default: 30000ms)
  timeout: 60000,
  
  // Custom client info
  clientInfo: {
    name: 'my-app',
    version: '1.0.0',
  },
});
```

## API Reference

### `createMCPClient(config)`

Creates a new MCP client instance.

**Parameters:**
- `config.serverUrl` (string): URL of the MCP server
- `config.plugins` (MCPPlugin[]): Array of plugins to enable
- `config.headers` (object, optional): Custom HTTP headers
- `config.timeout` (number, optional): Request timeout in milliseconds
- `config.clientInfo` (object, optional): Client name and version

**Returns:** `MCPClient` instance

### `MCPClient` Methods

- `connect()`: Connect to the MCP server
- `disconnect()`: Disconnect from the server
- `callTool(name, args)`: Invoke a tool by name
- `getTool(name)`: Get tool definition by name
- `getEnabledTools()`: Get all enabled tools
- `getAvailableTools()`: Get all available tools
- `getOAuthConfig(pluginId)`: Get OAuth config for a plugin
- `getAllOAuthConfigs()`: Get all OAuth configurations
- `onMessage(handler)`: Register a message handler
- `isConnected()`: Check if connected
- `isInitialized()`: Check if initialized

## Architecture

The SDK is built with a modular architecture:

```
integrate-sdk/
├── src/
│   ├── client.ts           # Main MCPClient class
│   ├── index.ts            # Public exports
│   ├── config/
│   │   └── types.ts        # Configuration types
│   ├── transport/
│   │   └── http-stream.ts  # HTTP streaming transport (NDJSON)
│   ├── protocol/
│   │   ├── messages.ts     # MCP message types
│   │   └── jsonrpc.ts      # JSON-RPC implementation
│   └── plugins/
│       ├── types.ts        # Plugin interface
│       ├── github.ts       # GitHub plugin
│       ├── gmail.ts        # Gmail plugin
│       └── generic.ts      # Generic OAuth plugin
```

**Transport Layer:**
The SDK uses HTTP streaming with newline-delimited JSON (NDJSON) for bidirectional communication:
- Single persistent HTTP connection
- Messages sent as JSON followed by newline (`\n`)
- Automatic heartbeat to keep connection alive
- Compatible with MCP's `StreamableHTTPServer`

## MCP Server Requirements

Your MCP server should implement HTTP streaming transport compatible with MCP's `StreamableHTTPServer`:

- A single streaming endpoint (e.g., `POST /api/v1/mcp`) that:
  - Accepts HTTP POST with streaming request body (NDJSON format)
  - Returns streaming response body (NDJSON format)
  - Supports bidirectional communication over a single persistent connection
  - Messages are newline-delimited JSON (one JSON object per line)

And support these MCP protocol methods:
- `initialize` - Initialize the protocol connection
- `tools/list` - List available tools
- `tools/call` - Invoke a tool

**Example Go server setup:**
```go
httpServer := server.NewStreamableHTTPServer(s,
    server.WithEndpointPath("/api/v1/mcp"),
    server.WithHeartbeatInterval(30*time.Second),
    server.WithStateLess(false),
)
```

## TypeScript Support

The SDK is built with TypeScript and provides full type safety:

```typescript
import { createMCPClient, githubPlugin } from 'integrate-sdk';
import type { MCPToolCallResponse } from 'integrate-sdk';

const client = createMCPClient({
  serverUrl: 'http://localhost:3000/mcp',
  plugins: [
    githubPlugin({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
});

// Full type inference and IntelliSense support
await client.connect();
const result: MCPToolCallResponse = await client.callTool('github/createIssue', {
  repo: 'owner/repo',
  title: 'Bug report',
});
```

# Test Suite

Comprehensive test suite for the Integrate SDK.

## Test Structure

```
tests/
├── protocol/           # Protocol and JSON-RPC tests
│   └── jsonrpc.test.ts
├── plugins/            # Plugin system tests
│   └── plugin-system.test.ts
├── client/             # Client functionality tests
│   └── client.test.ts
├── integration/        # Integration tests with mock server
│   ├── mock-server.ts
│   └── integration.test.ts
├── setup.ts            # Test setup and utilities
└── README.md           # This file
```

## Running Tests

### All Tests
```bash
bun test
```

### Unit Tests Only
```bash
bun run test:unit
```

### Integration Tests Only
```bash
bun run test:integration
```

### Watch Mode
```bash
bun run test:watch
```

### With Coverage
```bash
bun run test:coverage
```

## Test Categories

### 1. Protocol Tests (`tests/protocol/`)
Tests for JSON-RPC 2.0 protocol implementation:
- Request/response formatting
- Notification handling
- Error responses
- Message parsing and serialization
- ID generation

### 2. Plugin System Tests (`tests/plugins/`)
Tests for the plugin architecture:
- GitHub plugin configuration
- Gmail plugin configuration
- Generic OAuth plugin creation
- Simple plugin creation
- OAuth config type guards
- Plugin lifecycle hooks

### 3. Client Tests (`tests/client/`)
Tests for the main MCP client:
- Client creation and configuration
- Plugin initialization
- OAuth configuration management
- Tool management
- Connection state tracking
- Error handling
- Message handlers

### 4. Integration Tests (`tests/integration/`)
End-to-end tests with a mock MCP server:
- Connection establishment
- Tool discovery
- Tool filtering by plugins
- Tool invocation
- Plugin lifecycle hooks
- Concurrent requests
- Error scenarios
- Connection timeout

## Mock Server

The integration tests use a mock MCP server that:
- Implements HTTP streaming with NDJSON
- Supports `initialize`, `tools/list`, and `tools/call` methods
- Returns configurable tools
- Handles heartbeat/ping messages
- Runs on a random port to avoid conflicts

Example usage:
```typescript
import { MockMCPServer } from './tests/integration/mock-server';

const server = new MockMCPServer({
  port: 3456,
  tools: [
    {
      name: 'test/echo',
      description: 'Echo test tool',
      inputSchema: { /* ... */ }
    }
  ]
});

await server.start();
// Run tests...
await server.stop();
```

## Writing New Tests

### Unit Test Example

```typescript
import { describe, test, expect } from "bun:test";
import { myFunction } from "../../src/module.js";

describe("My Module", () => {
  test("does something correctly", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Integration Test Example

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createMCPClient } from "../../src/client.js";
import { MockMCPServer } from "./mock-server.js";

describe("Integration Test", () => {
  let server: MockMCPServer;

  beforeAll(async () => {
    server = new MockMCPServer({ port: 3456 });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  test("connects and calls tool", async () => {
    const client = createMCPClient({
      serverUrl: server.getUrl(),
      plugins: [/* ... */],
    });

    await client.connect();
    const result = await client.callTool("test/tool");
    expect(result).toBeDefined();
    await client.disconnect();
  });
});
```

## Test Coverage

The test suite covers:
- ✅ JSON-RPC protocol implementation
- ✅ Plugin system and configuration
- ✅ Client initialization and lifecycle
- ✅ Tool discovery and filtering
- ✅ Tool invocation
- ✅ OAuth configuration management
- ✅ Error handling
- ✅ Connection management
- ✅ Concurrent requests
- ✅ Plugin lifecycle hooks

## Debugging Tests

Run tests with debug output:
```bash
DEBUG=1 bun test
```

Run specific test file:
```bash
bun test tests/protocol/jsonrpc.test.ts
```

Run specific test:
```bash
bun test -t "creates valid JSON-RPC request"
```

## Continuous Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

The CI pipeline runs:
1. Type checking
2. Unit tests
3. Integration tests
4. Build verification

See `.github/workflows/test.yml` for details.

## Common Issues

### Port Already in Use
Integration tests use port 3456. If this conflicts, modify `MockMCPServer` constructor.

### Test Timeouts
Integration tests have 10s timeout. Increase if needed:
```typescript
test("my test", async () => {
  // test code
}, 20000); // 20 second timeout
```

### Console Logs
Console logs are suppressed during tests unless `DEBUG=1` is set.

## Contributing

When adding new features:
1. Write unit tests for individual components
2. Write integration tests for end-to-end flows
3. Ensure all tests pass before submitting PR
4. Maintain test coverage above 80%



