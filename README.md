<img src="./assets/ariadne_service_logo.png" align="left" width="200" alt="Ariadne logo of a spool of thread" style="margin-right: 20px; margin-bottom: 10px;">


> In the myths, Dedalus was the master craftsman that gave men powerful wings.
> Ariadne was the clever problem-solver that threaded the way out of his labyrinth.
> Together, they made the impossible navigable.

Ariadne brings composable, structured workflows to Dedalus Labs' agent platform,
built off the backs of Effect and Effect-AI.

<br clear="left">

It aims to provide
 - Full type-safety and observability from error accumulation.
 - Composability for ease of evaluation and unit testing.

## Documentation

**[Read the full documentation](./docs/guide.md)** for comprehensive guides on:
- Quick Start & Installation
- Language Model API (generateText, streamText, generateObject, streamObject)
- Tools & Toolkits
- Chat (Stateful Conversations)
- MCP Server Integration
- Embeddings
- Configuration & Error Handling

## Installation

```bash
bun install ariadne
```

## Quick Start

```typescript
import { LanguageModel, Tool, Toolkit } from "@src/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@src/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer, Schema } from "effect"
import * as Redacted from "effect/Redacted"

// 1. Create the client layer
const Dedalus = DedalusClient.layer({
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))

// 2. Create a model (supports multi-provider routing)
const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")

// 3. Define a tool (optional)
const Calculator = Tool.make("Calculator", {
  description: "Perform arithmetic",
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

// 4. Generate text with tools
const program = LanguageModel.generateText({
  prompt: "What is 15 multiplied by 7?",
  toolkit,
})

// 5. Run
const result = await program.pipe(
  Effect.provide(toolkitLive),
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)

console.log(result.text)
console.log(result.toolResults) // [{ name: "Calculator", result: 105 }]
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Develop with watch mode
bun run dev

# Run tests
bun run test

# Lint and format
bun run lint
bun run format
```

## Effect AI Packages

This repo includes a fork of the [Effect AI packages](https://github.com/Effect-TS/effect/tree/main/packages/ai). Upstream changes are monitored and selectively merged as needed.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT
