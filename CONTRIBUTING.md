# Contributing to Integrate SDK

Thank you for your interest in contributing to Integrate SDK! This document provides guidelines and instructions for contributing.

## Development Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd integrate-sdk
```

2. Install dependencies:

```bash
bun install
```

3. Run type checking:

```bash
bun run type-check
```

4. Build the project:

```bash
bun run build
```

## Project Structure

```
integrate-sdk/
├── src/
│   ├── client.ts           # Main MCPClient class
│   ├── index.ts            # Public exports
│   ├── config/
│   │   └── types.ts        # Configuration types
│   ├── transport/
│   │   └── http-stream.ts  # HTTP streaming transport
│   ├── protocol/
│   │   ├── messages.ts     # MCP message types
│   │   └── jsonrpc.ts      # JSON-RPC implementation
│   └── integrations/
│       ├── types.ts        # Integration interface
│       ├── github.ts       # GitHub integration
│       ├── gmail.ts        # Gmail integration
│       └── generic.ts      # Generic OAuth integration
├── examples/               # Usage examples
├── dist/                   # Built files (generated)
└── types/                  # Type declarations
```

## Making Changes

1. Create a new branch:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and ensure they pass type checking:

```bash
bun run type-check
```

3. Build the project to ensure it compiles:

```bash
bun run build
```

4. Test your changes with the examples:

```bash
bun examples/basic-usage.ts
```

## Creating a New Integration

To create a new integration, follow this pattern:

```typescript
import type { MCPIntegration, OAuthConfig } from "./types.js";

export interface YourIntegrationConfig {
  clientId: string;
  clientSecret: string;
  // ... other config
}

const YOUR_TOOLS = [
  "your-integration/tool1",
  "your-integration/tool2",
  // ... more tools
] as const;

export function yourIntegration(
  config: YourIntegrationConfig
): MCPIntegration<YourIntegrationConfig> {
  const oauth: OAuthConfig<YourIntegrationConfig> = {
    provider: "your-provider",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: ["scope1", "scope2"],
    config,
  };

  return {
    id: "your-integration",
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

export type YourIntegrationTools = (typeof YOUR_TOOLS)[number];
```

## Code Style

- Use TypeScript strict mode
- Follow the existing code style
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefix unused parameters with underscore (e.g., `_client`)

## Type Safety

- Always provide proper types
- Avoid using `any`
- Use TypeScript's type inference where possible
- Export types alongside implementation

## Commit Messages

Follow conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build process or auxiliary tool changes

Examples:

```
feat: add Slack integration with OAuth support
fix: handle connection timeout properly
docs: update README with new examples
```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md with your changes
3. Ensure all type checks pass
4. Create a pull request with a clear description of the changes
5. Link any related issues

## Questions?

If you have questions or need help, please open an issue for discussion.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
