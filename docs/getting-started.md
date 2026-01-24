# Getting Started

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

## Next Steps

- [Language Model](./language-model.md) - Learn about text generation and structured outputs
- [Tools & Toolkits](./tools.md) - Add tool calling to your agents
- [Chat](./chat.md) - Build multi-turn conversations
