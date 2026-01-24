# Configuration

## DedalusClient Configuration

The `DedalusClient` is the HTTP client for communicating with the Dedalus Labs API.

### Basic Configuration

```typescript
import { DedalusClient } from "@src/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Layer } from "effect"
import * as Redacted from "effect/Redacted"

const Dedalus = DedalusClient.layer({
  // API key (required)
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))
```

### Full Configuration Options

```typescript
const Dedalus = DedalusClient.layer({
  // Standard API key (OAuth-style Bearer token)
  apiKey: Redacted.make("..."),

  // Alternative: X-API-Key header style
  xApiKey: Redacted.make("..."),

  // Environment (default: "production")
  // - "production": https://api.dedaluslabs.ai
  // - "development": http://localhost:8080
  environment: "production",

  // Custom API URL (overrides environment)
  apiUrl: "https://custom-api.example.com",

  // BYOK (Bring Your Own Key) - use your own provider keys
  provider: "openai",
  providerKey: Redacted.make("sk-..."),

  // Transform the underlying HTTP client
  transformClient: (client) =>
    client.pipe(
      HttpClient.retry({ times: 3 }),
      HttpClient.timeout("30 seconds"),
    ),
})
```

### Using Effect Config

Read configuration from environment variables:

```typescript
import { Config } from "effect"

const Dedalus = DedalusClient.layerConfig({
  apiKey: Config.redacted("DEDALUS_API_KEY"),

  environment: Config.literal("production", "development")(
    "DEDALUS_ENVIRONMENT",
  ).pipe(Config.withDefault("production")),

  apiUrl: Config.string("DEDALUS_API_URL").pipe(Config.optional),
})
```

## Model Configuration

### Basic Model

```typescript
import { DedalusLanguageModel } from "@src/dedalus-labs"

const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")
```

### Model with Configuration

```typescript
const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o", {
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 4096,
  presence_penalty: 0.1,
  frequency_penalty: 0.1,
})
```

### Available Configuration Options

```typescript
interface Config.Service {
  temperature?: number        // Randomness (0-2)
  top_p?: number             // Nucleus sampling
  max_tokens?: number        // Maximum output tokens
  presence_penalty?: number  // Penalize repeated topics (-2 to 2)
  frequency_penalty?: number // Penalize repeated tokens (-2 to 2)
  stop?: Array<string>       // Stop sequences
  // ... other OpenAI-compatible options
}
```

## Runtime Configuration Override

Override configuration for specific calls using `withConfigOverride`:

```typescript
import { DedalusLanguageModel } from "@src/dedalus-labs"

const program = LanguageModel.generateText({
  prompt: "Be creative!",
})

// Override temperature for this specific call
const creative = DedalusLanguageModel.withConfigOverride(
  { temperature: 0.9 },
  program,
)

// Run with override
creative.pipe(
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

### Dual API

`withConfigOverride` supports both data-first and data-last styles:

```typescript
// Data-last (pipeable)
program.pipe(
  DedalusLanguageModel.withConfigOverride({ temperature: 0.9 }),
)

// Data-first
DedalusLanguageModel.withConfigOverride(program, { temperature: 0.9 })
```

## Multi-Model Routing

Let Dedalus automatically route to the best available model:

```typescript
const MultiModel = DedalusLanguageModel.model([
  "openai/gpt-4o",
  "anthropic/claude-sonnet-4-20250514",
])
```

Dedalus will:
- Try models in order
- Route based on availability
- Handle provider-specific formatting

## Available Models

Models use the format `provider/model-name`:

```typescript
// OpenAI
"openai/gpt-4o"
"openai/gpt-4o-mini"
"openai/gpt-4-turbo"

// Anthropic
"anthropic/claude-opus-4"
"anthropic/claude-sonnet-4-20250514"
"anthropic/claude-haiku-3-5"
```

## Mixing Models

Use different models for different parts of your application:

```typescript
const Gpt4oMini = DedalusLanguageModel.model("openai/gpt-4o-mini")
const ClaudeSonnet = DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514")

const program = Effect.gen(function* () {
  // Use GPT for quick tasks
  const quickResponse = yield* LanguageModel.generateText({
    prompt: "Summarize this in one sentence",
  }).pipe(Effect.provide(Gpt4oMini))

  // Use Claude for complex reasoning
  const detailedResponse = yield* LanguageModel.generateText({
    prompt: "Analyze this problem step by step",
  }).pipe(Effect.provide(ClaudeSonnet))

  return { quickResponse, detailedResponse }
})

program.pipe(
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

## Embedding Model Configuration

```typescript
import { DedalusEmbeddingModel } from "@src/dedalus-labs"

// Basic
const Embeddings = DedalusEmbeddingModel.model("openai/text-embedding-3-small")

// With mode
const BatchedEmbeddings = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "batched" },
)

// Data-loader with window
const DataLoaderEmbeddings = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "data-loader", window: "100 millis" },
)

// Override at runtime
DedalusEmbeddingModel.withConfigOverride(
  { dimensions: 512 },
  embeddingProgram,
)
```

## Next Steps

- [Error Handling](./error-handling.md) - Handle configuration errors
- [Execution Planning](./execution-planning.md) - Configure fallback models
