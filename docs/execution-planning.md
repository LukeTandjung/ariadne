# Execution Planning

The `ExecutionPlan` module from Effect provides a robust method for creating **structured execution plans** for your AI programs. Rather than making a single model call and hoping it succeeds, you can use `ExecutionPlan` to describe how to handle errors, retries, and fallbacks in a clear, declarative way.

## Why Execution Planning?

Imagine your AI program can fail with domain-specific errors:

```typescript
import { LanguageModel } from "@src/ariadne"
import { Data, Effect } from "effect"

class NetworkError extends Data.TaggedError("NetworkError") {}
class ProviderOutage extends Data.TaggedError("ProviderOutage") {}

declare const generateDadJoke: Effect.Effect<
  LanguageModel.GenerateTextResponse<{}>,
  NetworkError | ProviderOutage,
  LanguageModel.LanguageModel
>
```

You might want to:
- Retry on `NetworkError` with exponential backoff
- Fallback to a different provider on `ProviderOutage`
- Control timing between retry attempts

## Creating an Execution Plan

Use `ExecutionPlan.make` to define retry and fallback behavior:

```typescript
import { ExecutionPlan, Schedule } from "effect"
import { DedalusLanguageModel } from "@src/dedalus-labs"

const DadJokePlan = ExecutionPlan.make({
  provide: DedalusLanguageModel.model("openai/gpt-4o"),
  attempts: 3,
  schedule: Schedule.exponential("100 millis", 1.5),
  while: (error: NetworkError | ProviderOutage) =>
    error._tag === "NetworkError",
})
```

This plan will:
- Provide `"openai/gpt-4o"` as the `LanguageModel`
- Attempt up to 3 times
- Wait with exponential backoff between attempts (starting at 100ms)
- Only retry if the error is a `NetworkError`

## Applying an Execution Plan

Use `Effect.withExecutionPlan` to apply the plan to your program:

```typescript
const main = Effect.gen(function* () {
  const response = yield* generateDadJoke
  console.log(response.text)
}).pipe(Effect.withExecutionPlan(DadJokePlan))
```

## Adding Fallback Models

Define multiple steps in your execution plan to fallback to different providers:

```typescript
const ResilientPlan = ExecutionPlan.make(
  // Step 1: Try OpenAI first
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o"),
    attempts: 3,
    schedule: Schedule.exponential("100 millis", 1.5),
    while: (error: NetworkError | ProviderOutage) =>
      error._tag === "NetworkError",
  },
  // Step 2: Fallback to Anthropic
  {
    provide: DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514"),
    attempts: 2,
    schedule: Schedule.exponential("100 millis", 1.5),
    while: (error: NetworkError | ProviderOutage) =>
      error._tag === "ProviderOutage",
  }
)
```

### How Fallback Works

**Step 1** will:
- Try OpenAI up to 3 times
- Only retry on `NetworkError`
- If all attempts fail or error is `ProviderOutage`, move to Step 2

**Step 2** will:
- Try Anthropic up to 2 times
- Only retry on `ProviderOutage`
- If all attempts fail, the error propagates

## Complete Example

```typescript
import { LanguageModel } from "@src/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@src/dedalus-labs"
import { NodeHttpClient } from "@effect/platform-node"
import { Config, Data, Effect, ExecutionPlan, Layer, Schedule } from "effect"

// Define error types
class NetworkError extends Data.TaggedError("NetworkError") {}
class ProviderOutage extends Data.TaggedError("ProviderOutage") {}

// Your AI program
const generateDadJoke = Effect.gen(function* () {
  const response = yield* LanguageModel.generateText({
    prompt: "Tell me a dad joke",
  })
  return response
})

// Execution plan with retry and fallback
const DadJokePlan = ExecutionPlan.make(
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o"),
    attempts: 3,
    schedule: Schedule.exponential("100 millis", 1.5),
    while: (error: NetworkError | ProviderOutage) =>
      error._tag === "NetworkError",
  },
  {
    provide: DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514"),
    attempts: 2,
    schedule: Schedule.exponential("100 millis", 1.5),
    while: (error: NetworkError | ProviderOutage) =>
      error._tag === "ProviderOutage",
  }
)

// Apply plan and run
const main = Effect.gen(function* () {
  const response = yield* generateDadJoke
  console.log(response.text)
}).pipe(Effect.withExecutionPlan(DadJokePlan))

// Client layer
const Dedalus = DedalusClient.layerConfig({
  apiKey: Config.redacted("DEDALUS_API_KEY"),
}).pipe(Layer.provide(NodeHttpClient.layerUndici))

main.pipe(
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

## Schedule Options

Control timing between retries using Effect's `Schedule` module:

```typescript
// Exponential backoff: 100ms, 150ms, 225ms, ...
Schedule.exponential("100 millis", 1.5)

// Fixed delay: 500ms between each attempt
Schedule.spaced("500 millis")

// Linear: 100ms, 200ms, 300ms, ...
Schedule.linear("100 millis")

// Limit total attempts
Schedule.exponential("100 millis").pipe(
  Schedule.compose(Schedule.recurs(5))
)

// Add jitter to prevent thundering herd
Schedule.exponential("100 millis").pipe(
  Schedule.jittered
)
```

## Conditional Retry

The `while` predicate controls when to retry:

```typescript
ExecutionPlan.make({
  provide: model,
  attempts: 3,
  // Only retry on specific error types
  while: (error) => {
    if (error._tag === "NetworkError") return true
    if (error._tag === "RateLimitError") return true
    return false  // Don't retry other errors
  },
})
```

## Use Cases

### Resilient Production Agents

```typescript
const ProductionPlan = ExecutionPlan.make(
  // Primary: Fast model
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o-mini"),
    attempts: 2,
    schedule: Schedule.exponential("50 millis"),
    while: isRetryableError,
  },
  // Fallback: More capable model
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o"),
    attempts: 2,
    schedule: Schedule.exponential("100 millis"),
    while: isRetryableError,
  },
  // Final fallback: Different provider
  {
    provide: DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514"),
    attempts: 1,
    while: () => false,  // No retry, last resort
  }
)
```

### Cost Optimization

```typescript
const CostOptimizedPlan = ExecutionPlan.make(
  // Try cheap model first
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o-mini"),
    attempts: 1,
    while: (error) => error._tag === "InsufficientCapability",
  },
  // Upgrade to more capable model if needed
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o"),
    attempts: 2,
    schedule: Schedule.exponential("100 millis"),
    while: isRetryableError,
  }
)
```

## Next Steps

- [Configuration](./configuration.md) - Configure models and clients
- [Error Handling](./error-handling.md) - Handle errors effectively
