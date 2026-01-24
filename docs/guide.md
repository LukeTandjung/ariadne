# Ariadne SDK Documentation

Ariadne is a composable, type-safe agent SDK built on [Effect](https://effect.website) that provides a unified interface for building AI-powered applications. It combines the elegant API design of Effect-AI with [Dedalus Labs](https://dedaluslabs.ai)' infrastructure for routing, MCP server hosting, and multi-provider support.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Language Model](#language-model)
- [Tools and Toolkits](#tools-and-toolkits)
- [Chat (Stateful Conversations)](#chat-stateful-conversations)
- [MCP Server Integration](#mcp-server-integration)
- [Structured Outputs](#structured-outputs)
- [Streaming](#streaming)
- [Embeddings](#embeddings)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [API Reference](#api-reference)

---

## Overview

### What is Ariadne?

Ariadne brings together three powerful technologies:

1. **Effect-TS**: A TypeScript library for building type-safe, composable applications with excellent error handling and dependency injection.

2. **Effect-AI API Surface**: A provider-agnostic interface for interacting with language models, originally from the Effect ecosystem.

3. **Dedalus Labs Infrastructure**: A unified AI gateway that provides:
   - Multi-provider model routing (OpenAI, Anthropic, and more)
   - Server-side MCP (Model Context Protocol) tool execution
   - Automatic batching and optimization

### Key Features

- **Provider Agnostic**: Write your AI logic once, swap providers at runtime
- **Full Type Safety**: Comprehensive TypeScript types for all operations
- **Composable**: Build complex workflows from simple, testable pieces
- **Streaming First**: Native support for streaming text and structured outputs
- **Tool Calling**: Type-safe tool definitions with automatic schema generation
- **MCP Integration**: Connect to hosted MCP servers from the Dedalus marketplace
- **Observability**: Built-in OpenTelemetry support for tracing and metrics

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│                  @src/ariadne (Core)                    │
│  LanguageModel │ Chat │ Tool │ Toolkit │ Prompt │ ...   │
├─────────────────────────────────────────────────────────┤
│               @src/dedalus-labs (Provider)              │
│    DedalusLanguageModel │ DedalusClient │ Config        │
├─────────────────────────────────────────────────────────┤
│                  Dedalus Labs API                        │
│    OpenAI │ Anthropic │ MCP Servers │ Model Routing     │
└─────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
# Using bun (recommended)
bun add @src/ariadne @src/dedalus-labs

# Using npm
npm install @src/ariadne @src/dedalus-labs

# Using pnpm
pnpm add @src/ariadne @src/dedalus-labs
```

You'll also need the Effect platform package for HTTP client support:

```bash
bun add @effect/platform
```

---

## Quick Start

Here's a minimal example to get you started:

```typescript
import { LanguageModel } from "@src/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@src/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer } from "effect"
import * as Redacted from "effect/Redacted"

// 1. Create the Dedalus client layer
const Dedalus = DedalusClient.layer({
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))

// 2. Create a model
const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")

// 3. Generate text
const program = LanguageModel.generateText({
  prompt: "What is the capital of France?",
})

// 4. Run the program
const result = await program.pipe(
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)

console.log(result.text)
// Output: "The capital of France is Paris."
```

---

## Core Concepts

### Effects and Layers

Ariadne is built on Effect, which means all operations return `Effect` values that describe computations. These computations are executed only when you call `Effect.runPromise` (or similar run functions).

```typescript
// This creates a description of what to do, but doesn't execute anything
const program = LanguageModel.generateText({
  prompt: "Hello!",
})

// This actually executes the computation
const result = await Effect.runPromise(program.pipe(Effect.provide(layers)))
```

### Dependency Injection

Ariadne uses Effect's dependency injection system. Services like `LanguageModel` and `DedalusClient` are provided via `Layer`:

```typescript
// Model provides LanguageModel service
const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")

// Client provides DedalusClient service
const Dedalus = DedalusClient.layer({ apiKey: ... })

// Compose layers and provide to your program
program.pipe(
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
)
```

### The Model Type

The `Model` type wraps a provider-specific implementation:

```typescript
// Model<ProviderName, Provides, Requires>
const Gpt4o: Model<"dedalus-labs", LanguageModel, DedalusClient>
```

This allows you to:
- Swap models at runtime
- Mix multiple providers in one application
- Test with mock implementations

---

## Language Model

The `LanguageModel` module provides the core interface for text generation.

### generateText

Generate text from a prompt:

```typescript
import { LanguageModel } from "@src/ariadne"
import { Effect } from "effect"

const program = Effect.gen(function* () {
  const response = yield* LanguageModel.generateText({
    prompt: "Explain quantum computing in simple terms",
  })

  console.log(response.text)           // The generated text
  console.log(response.finishReason)   // "stop", "length", "tool-calls", etc.
  console.log(response.usage)          // Token usage statistics

  return response
})
```

### With System Prompt

```typescript
const response = yield* LanguageModel.generateText({
  system: "You are a helpful assistant that speaks like a pirate.",
  prompt: "Tell me about the weather",
})
```

### Using Prompt Objects

For complex conversations, use structured prompts:

```typescript
import { Prompt } from "@src/ariadne"

const conversation = Prompt.make([
  { role: "system", content: "You are a math tutor." },
  { role: "user", content: [{ type: "text", text: "What is 2 + 2?" }] },
  { role: "assistant", content: [{ type: "text", text: "2 + 2 equals 4." }] },
  { role: "user", content: [{ type: "text", text: "And 3 + 3?" }] },
])

const response = yield* LanguageModel.generateText({
  prompt: conversation,
})
```

### Response Structure

The `GenerateTextResponse` contains:

```typescript
interface GenerateTextResponse<Tools> {
  content: Array<Part>           // All response parts
  text: string                    // Combined text content
  reasoning: Array<ReasoningPart> // Reasoning/thinking content (if available)
  reasoningText: string | undefined
  toolCalls: Array<ToolCallPart>  // Tool invocations
  toolResults: Array<ToolResultPart> // Tool execution results
  finishReason: FinishReason      // Why generation stopped
  usage: Usage                    // Token statistics
}
```

---

## Tools and Toolkits

Tools allow language models to perform actions like calling APIs, querying databases, or executing code.

### Defining a Tool

```typescript
import { Tool } from "@src/ariadne"
import { Schema } from "effect"

const GetWeather = Tool.make("GetWeather", {
  description: "Get the current weather for a location",
  parameters: {
    location: Schema.String.annotations({
      description: "The city and state, e.g. San Francisco, CA",
    }),
    unit: Schema.optional(Schema.Literal("celsius", "fahrenheit")),
  },
  success: Schema.Struct({
    temperature: Schema.Number,
    condition: Schema.String,
    humidity: Schema.Number,
  }),
  failure: Schema.String,
})
```

### Creating a Toolkit

Group related tools into a toolkit:

```typescript
import { Toolkit } from "@src/ariadne"

const WeatherToolkit = Toolkit.make(GetWeather, GetForecast)
```

### Implementing Tool Handlers

```typescript
const WeatherToolkitLive = WeatherToolkit.toLayer({
  GetWeather: ({ location, unit }) =>
    Effect.gen(function* () {
      // Call your weather API here
      const data = yield* fetchWeatherApi(location)
      return {
        temperature: unit === "celsius" ? data.tempC : data.tempF,
        condition: data.condition,
        humidity: data.humidity,
      }
    }),
  GetForecast: ({ location, days }) =>
    Effect.succeed([/* forecast data */]),
})
```

### Using Tools with Language Model

```typescript
const program = LanguageModel.generateText({
  prompt: "What's the weather like in Tokyo?",
  toolkit: WeatherToolkit,
})

const result = await program.pipe(
  Effect.provide(WeatherToolkitLive),
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)

// The model will call GetWeather, and you'll get both
// the tool results and the final text response
console.log(result.toolResults) // [{ name: "GetWeather", result: {...} }]
console.log(result.text)        // "The weather in Tokyo is..."
```

### Tool Choice

Control which tools the model can use:

```typescript
// Let the model decide (default)
toolChoice: "auto"

// Force tool use
toolChoice: "required"

// No tools
toolChoice: "none"

// Force a specific tool
toolChoice: { tool: "GetWeather" }

// Allow only certain tools
toolChoice: { mode: "auto", oneOf: ["GetWeather", "GetForecast"] }
```

### Disabling Automatic Tool Resolution

By default, tools are automatically executed. To disable this:

```typescript
const response = yield* LanguageModel.generateText({
  prompt: "What's the weather?",
  toolkit: WeatherToolkit,
  disableToolCallResolution: true,
})

// Now you handle tool execution yourself
for (const toolCall of response.toolCalls) {
  console.log(toolCall.name, toolCall.params)
}
```

### Tool Concurrency

Control parallel tool execution:

```typescript
LanguageModel.generateText({
  prompt: "...",
  toolkit: MyToolkit,
  concurrency: 5,  // Max 5 tools in parallel
})
```

---

## Chat (Stateful Conversations)

The `Chat` module manages conversation history automatically.

### Creating a Chat

```typescript
import { Chat } from "@src/ariadne"

const program = Effect.gen(function* () {
  // Create an empty chat
  const chat = yield* Chat.empty

  // First message
  const response1 = yield* chat.generateText({
    prompt: "Hi! My name is Alice.",
  })

  // History is maintained automatically
  const response2 = yield* chat.generateText({
    prompt: "What's my name?",
  })

  console.log(response2.text)  // "Your name is Alice."
})
```

### Chat with System Prompt

```typescript
const chat = yield* Chat.fromPrompt([
  {
    role: "system",
    content: "You are a helpful coding assistant.",
  },
])

yield* chat.generateText({ prompt: "Help me write a function" })
```

### Exporting and Restoring Chat History

```typescript
// Export to JSON
const json = yield* chat.exportJson

// Save to database...
await saveToDatabase(userId, json)

// Later, restore the chat
const savedJson = await loadFromDatabase(userId)
const restoredChat = yield* Chat.fromJson(savedJson)
```

### Persistent Chat

For automatic persistence:

```typescript
import { BackingPersistence } from "@effect/experimental/Persistence"

const program = Effect.gen(function* () {
  const persistence = yield* Chat.Persistence

  // Get or create a chat with auto-save
  const chat = yield* persistence.getOrCreate("user-123", {
    timeToLive: Duration.days(7),
  })

  // All messages are automatically persisted
  yield* chat.generateText({ prompt: "Hello!" })
})

// Provide backing persistence (e.g., KeyValueStore)
program.pipe(
  Effect.provide(Chat.layerPersisted({ storeId: "chats" })),
  Effect.provide(yourPersistenceLayer),
)
```

### Streaming with Chat

```typescript
const chat = yield* Chat.empty

const stream = chat.streamText({
  prompt: "Write a poem about coding",
})

yield* stream.pipe(
  Stream.tap((part) =>
    Effect.sync(() => {
      if (part.type === "text-delta") {
        process.stdout.write(part.delta)
      }
    }),
  ),
  Stream.runDrain,
)
```

---

## MCP Server Integration

Ariadne supports [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers through the Dedalus Labs infrastructure. MCP servers are executed server-side, meaning you don't need to run them locally.

### Using Marketplace MCP Servers

```typescript
import { McpRegistry } from "@src/ariadne"

const response = yield* LanguageModel.generateText({
  prompt: "Search for TypeScript 5.7 features",
  mcpServers: [
    McpRegistry.marketplace("tsion/exa"),           // Exa search
    McpRegistry.marketplace("windsor/brave-search"), // Brave search
  ],
})
```

### Using Custom MCP Server URLs

```typescript
const response = yield* LanguageModel.generateText({
  prompt: "Get data from my API",
  mcpServers: [
    McpRegistry.url("https://my-mcp-server.example.com"),
  ],
})
```

### How MCP Works with Dedalus

1. You specify MCP servers in your request
2. Dedalus connects to those servers on your behalf
3. The model can call tools from those servers
4. Tool execution happens server-side
5. Results are included in the response

This means:
- No local MCP server management
- Tools from the Dedalus marketplace are pre-hosted
- You can mix local tools with MCP tools

---

## Structured Outputs

Generate typed, validated objects instead of raw text.

### generateObject

```typescript
import { LanguageModel } from "@src/ariadne"
import { Schema } from "effect"

const PersonSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  occupation: Schema.String,
})

const response = yield* LanguageModel.generateObject({
  prompt: "Create a fictional software engineer in their 30s.",
  schema: PersonSchema,
})

// response.value is fully typed and validated
console.log(response.value.name)       // string
console.log(response.value.age)        // number
console.log(response.value.occupation) // string
```

### Complex Schemas

```typescript
const RecipeSchema = Schema.Struct({
  title: Schema.String,
  ingredients: Schema.Array(Schema.String),
  steps: Schema.Array(Schema.String),
  prepTimeMinutes: Schema.Number,
  nutrition: Schema.Struct({
    calories: Schema.Number,
    protein: Schema.Number,
  }),
})

const response = yield* LanguageModel.generateObject({
  prompt: "Create a healthy breakfast recipe",
  schema: RecipeSchema,
  objectName: "recipe", // Optional: helps the model understand context
})
```

### Schema Validation

Schemas are validated at runtime using Effect's Schema library:

```typescript
const SentimentSchema = Schema.Struct({
  sentiment: Schema.Literal("positive", "negative", "neutral"),
  confidence: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.lessThanOrEqualTo(1),
  ),
  reasoning: Schema.String,
})
```

---

## Streaming

### Text Streaming

```typescript
const stream = LanguageModel.streamText({
  prompt: "Write a story",
})

yield* stream.pipe(
  Stream.tap((part) =>
    Effect.sync(() => {
      switch (part.type) {
        case "response-metadata":
          console.log(`Model: ${part.modelId}`)
          break
        case "text-delta":
          process.stdout.write(part.delta)
          break
        case "tool-call":
          console.log(`Tool called: ${part.name}`)
          break
        case "tool-result":
          console.log(`Tool result: ${part.result}`)
          break
        case "finish":
          console.log(`\nFinished: ${part.reason}`)
          console.log(`Tokens: ${part.usage.totalTokens}`)
          break
      }
    }),
  ),
  Stream.runDrain,
)
```

### Object Streaming

Stream structured objects with progressive parsing:

```typescript
const stream = LanguageModel.streamObject({
  prompt: "Create a detailed character profile",
  schema: CharacterSchema,
})

yield* stream.pipe(
  Stream.tap((part) =>
    Effect.sync(() => {
      switch (part.type) {
        case "object-delta":
          // Raw JSON delta
          console.log("Delta:", part.delta)
          // Accumulated JSON so far
          console.log("Accumulated:", part.accumulated)
          // Partially parsed object (may have undefined fields)
          console.log("Partial:", part.partial)
          break
        case "object-done":
          // Fully validated object
          console.log("Complete:", part.value)
          break
      }
    }),
  ),
  Stream.runDrain,
)
```

### Stream Parts

| Part Type | Description |
|-----------|-------------|
| `response-metadata` | Response ID, model ID, timestamp |
| `text-delta` | Incremental text content |
| `tool-params-start` | Tool call started |
| `tool-params-delta` | Tool parameters being streamed |
| `tool-params-end` | Tool parameters complete |
| `tool-call` | Complete tool call ready for execution |
| `tool-result` | Tool execution result |
| `object-delta` | Structured object delta |
| `object-done` | Complete validated object |
| `finish` | Generation complete with usage stats |
| `error` | Error occurred |

---

## Embeddings

Generate vector embeddings for semantic search, similarity, and clustering.

### Basic Usage

```typescript
import { EmbeddingModel } from "@src/ariadne"
import { DedalusEmbeddingModel } from "@src/dedalus-labs"

// Create the model
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
)

const program = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // Single embedding
  const vector = yield* model.embed("Hello, world!")
  console.log(vector.length) // 1536 dimensions

  // Multiple embeddings
  const vectors = yield* model.embedMany([
    "First document",
    "Second document",
  ])
})

program.pipe(
  Effect.provide(TextEmbedding),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

### Batched Mode

Automatically batches concurrent requests:

```typescript
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "batched" },
)

// These 3 concurrent calls are batched into 1 API request
const [v1, v2, v3] = yield* Effect.all([
  model.embed("Text 1"),
  model.embed("Text 2"),
  model.embed("Text 3"),
])
```

### Data Loader Mode

Batches requests within a time window:

```typescript
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "data-loader", window: "100 millis" },
)

// All requests within 100ms are batched together
```

---

## Configuration

### DedalusClient Configuration

```typescript
import { DedalusClient } from "@src/dedalus-labs"

const client = DedalusClient.layer({
  // Standard API key (recommended)
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),

  // Alternative: X-API-Key header
  xApiKey: Redacted.make("..."),

  // Environment (default: "production")
  environment: "production", // or "development" for localhost

  // Custom API URL (overrides environment)
  apiUrl: "https://custom-api.example.com",

  // BYOK (Bring Your Own Key) - use your own provider keys
  provider: "openai",
  providerKey: Redacted.make("sk-..."),

  // Transform the HTTP client
  transformClient: (client) =>
    client.pipe(HttpClient.retry({ times: 3 })),
})
```

### Using Effect Config

```typescript
const client = DedalusClient.layerConfig({
  apiKey: Config.redacted("DEDALUS_API_KEY"),
  environment: Config.literal("production", "development")(
    "DEDALUS_ENVIRONMENT",
  ).pipe(Config.withDefault("production")),
})
```

### Model Configuration

```typescript
const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o", {
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 4096,
  presence_penalty: 0.1,
  frequency_penalty: 0.1,
})
```

### Runtime Configuration Override

```typescript
import { DedalusLanguageModel } from "@src/dedalus-labs"

const program = LanguageModel.generateText({
  prompt: "Be creative!",
})

// Override config for this specific call
const creative = DedalusLanguageModel.withConfigOverride(
  { temperature: 0.9 },
  program,
)
```

### Multi-Model Routing

Let Dedalus route to the best available model:

```typescript
const MultiModel = DedalusLanguageModel.model([
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4-20250514",
])
```

### Available Models

Use the `Model` type for autocomplete:

```typescript
import type { Model } from "@src/dedalus-labs"

// Examples:
// "openai/gpt-4o"
// "openai/gpt-4o-mini"
// "anthropic/claude-sonnet-4-20250514"
// "anthropic/claude-opus-4"
```

---

## Error Handling

### Error Types

Ariadne provides structured error types:

```typescript
import { AiError } from "@src/ariadne"

type AiError =
  | AiError.HttpRequestError    // Network/request failures
  | AiError.HttpResponseError   // Non-OK HTTP responses
  | AiError.MalformedInput      // Invalid input data
  | AiError.MalformedOutput     // Failed to parse response
  | AiError.UnknownError        // Unexpected errors
```

### Handling Errors

```typescript
import { Match } from "effect"

const handleError = Match.type<AiError.AiError>().pipe(
  Match.tag("HttpRequestError", (err) =>
    Effect.logError(`Request failed: ${err.message}`),
  ),
  Match.tag("HttpResponseError", (err) =>
    Effect.logError(`Response error (${err.response.status})`),
  ),
  Match.tag("MalformedInput", (err) =>
    Effect.logError(`Invalid input: ${err.description}`),
  ),
  Match.tag("MalformedOutput", (err) =>
    Effect.logError(`Parse error: ${err.description}`),
  ),
  Match.orElse((err) =>
    Effect.logError(`Unknown error: ${err.message}`),
  ),
)
```

### Using catchTags

```typescript
const program = LanguageModel.generateText({
  prompt: "Hello",
}).pipe(
  Effect.catchTag("HttpResponseError", (error) =>
    Effect.succeed({ text: "Fallback response", ...defaults }),
  ),
  Effect.catchTag("MalformedOutput", (error) =>
    Effect.fail(new CustomError("Invalid response format")),
  ),
)
```

### Retry with Effect

```typescript
import { Schedule } from "effect"

const withRetry = program.pipe(
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.compose(Schedule.recurs(3)),
    ),
  ),
)
```

---

## API Reference

### @src/ariadne Exports

| Module | Description |
|--------|-------------|
| `AiError` | Error types for AI operations |
| `Chat` | Stateful conversation management |
| `EmbeddingModel` | Vector embedding service |
| `IdGenerator` | Unique ID generation |
| `LanguageModel` | Text/object generation service |
| `McpRegistry` | MCP server specifications |
| `McpSchema` | MCP protocol schemas |
| `McpServer` | Local MCP server management |
| `Model` | Provider wrapper type |
| `Prompt` | Conversation/message structures |
| `Response` | Response part types |
| `Telemetry` | OpenTelemetry integration |
| `Tokenizer` | Token counting/truncation |
| `Tool` | Tool definitions |
| `Toolkit` | Tool collections |

### @src/dedalus-labs Exports

| Module | Description |
|--------|-------------|
| `DedalusClient` | HTTP client for Dedalus API |
| `DedalusLanguageModel` | Language model implementation |
| `DedalusEmbeddingModel` | Embedding model implementation |
| `DedalusConfig` | Client configuration |
| `Generated` | Auto-generated API types |

### LanguageModel Methods

```typescript
// Generate text
LanguageModel.generateText(options): Effect<GenerateTextResponse>

// Generate structured object
LanguageModel.generateObject(options): Effect<GenerateObjectResponse>

// Stream text
LanguageModel.streamText(options): Stream<StreamPart>

// Stream structured object
LanguageModel.streamObject(options): Stream<StreamObjectPart>
```

### Chat Methods

```typescript
// Create empty chat
Chat.empty: Effect<Chat.Service>

// Create from prompt
Chat.fromPrompt(prompt): Effect<Chat.Service>

// Restore from export
Chat.fromExport(data): Effect<Chat.Service>
Chat.fromJson(json): Effect<Chat.Service>

// Chat.Service methods
chat.generateText(options): Effect<GenerateTextResponse>
chat.generateObject(options): Effect<GenerateObjectResponse>
chat.streamText(options): Stream<StreamPart>
chat.export: Effect<unknown>
chat.exportJson: Effect<string>
chat.history: Ref<Prompt>
```

### Tool Methods

```typescript
// Create user-defined tool
Tool.make(name, options): Tool

// Create provider-defined tool
Tool.providerDefined(options): ProviderDefinedTool

// From Effect TaggedRequest
Tool.fromTaggedRequest(schema): Tool

// Get JSON Schema
Tool.getJsonSchema(tool): JsonSchema

// Type guards
Tool.isUserDefined(tool): boolean
Tool.isProviderDefined(tool): boolean
```

### Toolkit Methods

```typescript
// Create toolkit
Toolkit.make(...tools): Toolkit

// Implement handlers
toolkit.toLayer(handlers): Layer

// Empty toolkit
Toolkit.empty: Toolkit
```

### McpRegistry Methods

```typescript
// From marketplace slug
McpRegistry.marketplace(id): McpServerSpec

// From URL
McpRegistry.url(url): McpServerSpec

// Convert to API format
McpRegistry.toApiFormat(servers): Array<string>
```

---

## Examples

### Complete Agent with Tools and Streaming

```typescript
import { LanguageModel, Tool, Toolkit, McpRegistry } from "@src/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@src/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer, Stream, Schema } from "effect"
import * as Redacted from "effect/Redacted"

// Define tools
const Calculator = Tool.make("Calculator", {
  description: "Perform arithmetic calculations",
  parameters: {
    operation: Schema.Literal("add", "subtract", "multiply", "divide"),
    a: Schema.Number,
    b: Schema.Number,
  },
  success: Schema.Number,
})

const toolkit = Toolkit.make(Calculator)

const toolkitLive = toolkit.toLayer({
  Calculator: ({ operation, a, b }) =>
    Effect.succeed(
      operation === "add" ? a + b :
      operation === "subtract" ? a - b :
      operation === "multiply" ? a * b :
      a / b,
    ),
})

// Create layers
const Dedalus = DedalusClient.layer({
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))

const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")

// Main program with streaming
const program = Effect.gen(function* () {
  const stream = LanguageModel.streamText({
    prompt: "Calculate 15 * 7 and explain the result",
    toolkit,
    mcpServers: [McpRegistry.marketplace("windsor/brave-search")],
  })

  yield* stream.pipe(
    Stream.tap((part) =>
      Effect.sync(() => {
        if (part.type === "text-delta") {
          process.stdout.write(part.delta)
        } else if (part.type === "tool-result") {
          console.log(`\n[Tool: ${part.name}] Result: ${part.result}`)
        }
      }),
    ),
    Stream.runDrain,
  )
})

// Run
program.pipe(
  Effect.provide(toolkitLive),
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

### Multi-Turn Chat with Persistence

```typescript
import { Chat, LanguageModel } from "@src/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@src/dedalus-labs"
import { Effect, Layer } from "effect"

const program = Effect.gen(function* () {
  // Create chat with system prompt
  const chat = yield* Chat.fromPrompt([
    {
      role: "system",
      content: "You are a helpful assistant. Be concise.",
    },
  ])

  // Conversation
  const r1 = yield* chat.generateText({
    prompt: "Hi! I'm learning TypeScript.",
  })
  console.log("Assistant:", r1.text)

  const r2 = yield* chat.generateText({
    prompt: "What's the difference between interface and type?",
  })
  console.log("Assistant:", r2.text)

  // Export for later
  const backup = yield* chat.exportJson
  console.log("Chat saved:", backup.length, "bytes")

  return backup
})

// Later, restore the conversation
const restore = (json: string) =>
  Effect.gen(function* () {
    const chat = yield* Chat.fromJson(json)

    const r = yield* chat.generateText({
      prompt: "Can you give me an example of what we discussed?",
    })

    console.log("Assistant:", r.text)
  })
```

---

## Migration from Effect-AI

If you're migrating from `@effect/ai`:

1. **Import paths**: Change `@effect/ai` to `@src/ariadne`
2. **Provider**: Replace `@effect/ai-openai` with `@src/dedalus-labs`
3. **Model names**: Use Dedalus format: `"openai/gpt-4o"` instead of `"gpt-4o"`
4. **MCP**: Use `McpRegistry` for server-side MCP integration

```typescript
// Before (Effect-AI)
import { LanguageModel } from "@effect/ai"
import { OpenAiLanguageModel } from "@effect/ai-openai"

const Gpt4o = OpenAiLanguageModel.model("gpt-4o")

// After (Ariadne)
import { LanguageModel } from "@src/ariadne"
import { DedalusLanguageModel } from "@src/dedalus-labs"

const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")
```

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT
