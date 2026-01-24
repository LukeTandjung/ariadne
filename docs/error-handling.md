# Error Handling

Ariadne provides structured error types that integrate with Effect's error handling.

## Error Types

```typescript
import { AiError } from "@src/ariadne"

type AiError =
  | AiError.HttpRequestError    // Network/request failures
  | AiError.HttpResponseError   // Non-OK HTTP responses
  | AiError.MalformedInput      // Invalid input data
  | AiError.MalformedOutput     // Failed to parse response
  | AiError.UnknownError        // Unexpected errors
```

### HttpRequestError

Occurs when the HTTP request fails (network issues, timeouts):

```typescript
class HttpRequestError {
  readonly _tag: "HttpRequestError"
  readonly module: string    // e.g., "DedalusClient"
  readonly method: string    // e.g., "createChatCompletion"
  readonly reason: string    // e.g., "Transport"
  readonly request: HttpClientRequest
}
```

### HttpResponseError

Occurs when the API returns a non-OK status:

```typescript
class HttpResponseError {
  readonly _tag: "HttpResponseError"
  readonly module: string
  readonly method: string
  readonly response: HttpClientResponse  // Contains status, body, etc.
}
```

### MalformedInput

Occurs when input data doesn't match expected format:

```typescript
class MalformedInput {
  readonly _tag: "MalformedInput"
  readonly module: string
  readonly method: string
  readonly description: string
}
```

### MalformedOutput

Occurs when response data can't be parsed:

```typescript
class MalformedOutput {
  readonly _tag: "MalformedOutput"
  readonly module: string
  readonly method: string
  readonly description: string
  readonly cause: unknown
}
```

## Handling Errors with catchTag

Handle specific error types:

```typescript
const program = LanguageModel.generateText({
  prompt: "Hello",
}).pipe(
  Effect.catchTag("HttpResponseError", (error) => {
    console.log(`API error: ${error.response.status}`)
    return Effect.succeed({ text: "Fallback response", ...defaults })
  }),
  Effect.catchTag("MalformedOutput", (error) => {
    console.log(`Parse error: ${error.description}`)
    return Effect.fail(new CustomError("Invalid response"))
  }),
)
```

## Pattern Matching with Match

Use Effect's Match for comprehensive error handling:

```typescript
import { Match } from "effect"

const handleError = Match.type<AiError.AiError>().pipe(
  Match.tag("HttpRequestError", (err) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Request failed: ${err.reason}`)
      return { text: "Network error, please try again" }
    }),
  ),
  Match.tag("HttpResponseError", (err) =>
    Effect.gen(function* () {
      if (err.response.status === 429) {
        yield* Effect.logWarning("Rate limited")
        return { text: "Too many requests" }
      }
      yield* Effect.logError(`API error: ${err.response.status}`)
      return { text: "Service unavailable" }
    }),
  ),
  Match.tag("MalformedInput", (err) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Invalid input: ${err.description}`)
      return Effect.fail(new ValidationError(err.description))
    }),
  ),
  Match.tag("MalformedOutput", (err) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Parse error: ${err.description}`)
      return { text: "Could not parse response" }
    }),
  ),
  Match.orElse((err) =>
    Effect.gen(function* () {
      yield* Effect.logError(`Unknown error: ${err}`)
      return { text: "An unexpected error occurred" }
    }),
  ),
)

const program = LanguageModel.generateText({
  prompt: "Hello",
}).pipe(
  Effect.catchAll(handleError),
)
```

## Retry Patterns

### Simple Retry

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

### Conditional Retry

Only retry on specific errors:

```typescript
const withConditionalRetry = program.pipe(
  Effect.retry({
    schedule: Schedule.exponential("100 millis"),
    while: (error) => error._tag === "HttpRequestError",
  }),
)
```

### Retry with Timeout

```typescript
const withTimeout = program.pipe(
  Effect.timeout("30 seconds"),
  Effect.retry(Schedule.recurs(2)),
)
```

## Fallback Patterns

### Simple Fallback

```typescript
const withFallback = program.pipe(
  Effect.orElse(() =>
    Effect.succeed({ text: "Fallback response" }),
  ),
)
```

### Fallback to Different Model

```typescript
const withModelFallback = program.pipe(
  Effect.provide(Gpt4o),
  Effect.catchAll(() =>
    program.pipe(Effect.provide(ClaudeSonnet)),
  ),
)
```

### Use Execution Planning

For complex retry/fallback logic, use [Execution Planning](./execution-planning.md):

```typescript
const plan = ExecutionPlan.make(
  {
    provide: DedalusLanguageModel.model("openai/gpt-4o"),
    attempts: 3,
    schedule: Schedule.exponential("100 millis"),
    while: (err) => err._tag === "HttpRequestError",
  },
  {
    provide: DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514"),
    attempts: 2,
  },
)

program.pipe(Effect.withExecutionPlan(plan))
```

## Logging Errors

```typescript
const withLogging = program.pipe(
  Effect.tapError((error) =>
    Effect.logError("AI operation failed", { error }),
  ),
)
```

## Creating Custom Errors

```typescript
import { Data } from "effect"

class CustomAiError extends Data.TaggedError("CustomAiError")<{
  message: string
  originalError: AiError.AiError
}> {}

const program = LanguageModel.generateText({
  prompt: "Hello",
}).pipe(
  Effect.mapError((error) =>
    new CustomAiError({
      message: "Failed to generate response",
      originalError: error,
    }),
  ),
)
```

## Chat-Specific Errors

### ChatNotFoundError

When accessing a persisted chat that doesn't exist:

```typescript
import { Chat } from "@src/ariadne"

const program = Effect.gen(function* () {
  const persistence = yield* Chat.Persistence
  const chat = yield* persistence.get("non-existent-id")
}).pipe(
  Effect.catchTag("ChatNotFoundError", (error) =>
    Effect.gen(function* () {
      console.log(`Chat ${error.chatId} not found`)
      return yield* Chat.empty
    }),
  ),
)
```

## Next Steps

- [Execution Planning](./execution-planning.md) - Structured retry and fallback
- [API Reference](./api-reference.md) - Complete error type reference
