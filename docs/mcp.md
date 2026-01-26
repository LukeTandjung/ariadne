# MCP Servers

Ariadne supports [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers through the Dedalus Labs infrastructure. MCP servers are executed server-side, meaning you don't need to run them locally.

## How MCP Works with Dedalus

1. You specify MCP servers in your request
2. Dedalus connects to those servers on your behalf
3. The model can call tools from those servers
4. Tool execution happens server-side
5. Results are included in the response

This means:
- No local MCP server management
- Tools from the Dedalus marketplace are pre-hosted
- You can mix local tools with MCP tools

## Using Marketplace MCP Servers

```typescript
import { McpRegistry, LanguageModel } from "@luketandjung/ariadne"

const response = yield* LanguageModel.generateText({
  prompt: "Search for TypeScript 5.7 features",
  mcpServers: [
    McpRegistry.marketplace("tsion/exa"),           // Exa search
    McpRegistry.marketplace("windsor/brave-search"), // Brave search
  ],
})
```

## Using Custom MCP Server URLs

```typescript
const response = yield* LanguageModel.generateText({
  prompt: "Get data from my API",
  mcpServers: [
    McpRegistry.url("https://my-mcp-server.example.com"),
  ],
})
```

## Combining MCP with Local Tools

```typescript
import { Tool, Toolkit, McpRegistry, LanguageModel } from "@luketandjung/ariadne"

// Define a local tool
const Calculator = Tool.make("Calculator", {
  description: "Perform calculations",
  parameters: { expression: Schema.String },
  success: Schema.Number,
})

const toolkit = Toolkit.make(Calculator)

const toolkitLive = toolkit.toLayer({
  Calculator: ({ expression }) => Effect.succeed(eval(expression)),
})

// Use both local tools and MCP servers
const response = yield* LanguageModel.generateText({
  prompt: "Calculate 15 * 7 and search for math tutorials",
  toolkit,
  mcpServers: [
    McpRegistry.marketplace("windsor/brave-search"),
  ],
})

// Local tools are executed client-side
// MCP tools are executed server-side by Dedalus
```

## MCP Registry API

### marketplace

Create a specification for an MCP server from the Dedalus marketplace:

```typescript
// Using owner/repo format
McpRegistry.marketplace("dedalus-labs/brave-search")

// Using simple slug
McpRegistry.marketplace("weather-mcp")
```

### url

Create a specification for a self-hosted MCP server:

```typescript
McpRegistry.url("https://my-mcp-server.example.com")
```

### Type Guards

```typescript
const server = McpRegistry.marketplace("test/server")

if (McpRegistry.isMarketplace(server)) {
  console.log(server.id)  // "test/server"
}

if (McpRegistry.isUrl(server)) {
  console.log(server.url)
}
```

### toApiFormat

Convert specifications to API format:

```typescript
const servers = [
  McpRegistry.url("https://example.com"),
  McpRegistry.marketplace("owner/repo"),
]

const apiFormat = McpRegistry.toApiFormat(servers)
// ["https://example.com", "owner/repo"]
```

## MCP with Streaming

MCP tools work with streaming as well:

```typescript
const stream = LanguageModel.streamText({
  prompt: "Search for news about AI",
  mcpServers: [McpRegistry.marketplace("windsor/brave-search")],
})

yield* stream.pipe(
  Stream.tap((part) =>
    Effect.sync(() => {
      if (part.type === "tool-call" && part.providerExecuted) {
        console.log("MCP tool executed:", part.name)
      }
    }),
  ),
  Stream.runDrain,
)
```

## MCP with Chat

Use MCP servers in multi-turn conversations:

```typescript
const chat = yield* Chat.empty

const r1 = yield* chat.generateText({
  prompt: "Search for TypeScript tutorials",
  mcpServers: [McpRegistry.marketplace("tsion/exa")],
})

const r2 = yield* chat.generateText({
  prompt: "Now search for React tutorials",
  mcpServers: [McpRegistry.marketplace("tsion/exa")],
})
```

## Available Marketplace Servers

Check the [Dedalus Labs Marketplace](https://dedaluslabs.ai/marketplace) for available MCP servers, including:

- Search engines (Brave, Exa)
- Weather services
- Ticketmaster events
- And more...

## Next Steps

- [Execution Planning](./execution-planning.md) - Handle MCP failures with fallbacks
- [Configuration](./configuration.md) - Configure client options
