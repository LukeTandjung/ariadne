# Refined Acceptance Criteria: Effect-AI SDK Extension for Dedalus

This document refines the original acceptance criteria with implementation guidance based on analysis of both the effect-ai SDK and Dedalus Agent SDK.

---

## Table of Contents

1. [DedalusClient - HTTP Client Layer](#1-dedalusclient---http-client-layer)
   - 1.1 Dual Authentication
   - 1.2 BYOK Support
   - 1.3 SDK Headers
   - 1.4 Environmental Switching
   - 1.5 Error Handling
   - 1.6 Case Conversion
2. [DedalusLanguageModel - Provider Implementation](#2-dedaluslanguagemodel---provider-implementation)
3. [MCP Server Integration](#3-mcp-server-integration)
4. [Dynamic Model Routing](#4-dynamic-model-routing)
5. [Dedalus Features via Effect Primitives](#5-dedalus-features-via-effect-primitives)
   - 5.1 Retry/Backoff via ExecutionPlan
   - 5.2 State Management
   - 5.3 Timeout Configuration
   - 5.4 Idempotency Keys
   - 5.5 Max Steps
   - 5.6 Resource Management
   - 5.7 Streaming Tool Call Accumulation
   - 5.8 Runner vs Effect Chat Module
6. [Streaming Structured Output](#6-streaming-structured-output)

---

## 1. DedalusClient - HTTP Client Layer

### 1.1 Dual Authentication

**Dedalus SDK Pattern** (from `dedalus-sdk-typescript/src/client.ts:321-333`):

Dedalus supports two alternative authentication methods (use one, not both):

| Method | Header | Env Variable | Use Case |
|--------|--------|--------------|----------|
| Bearer token | `Authorization: Bearer <key>` | `DEDALUS_API_KEY` | Standard OAuth-style auth |
| API key header | `x-api-key: <key>` | `DEDALUS_X_API_KEY` | API gateway/proxy compatibility |

Both authenticate with Dedalus itself — neither is related to BYOK (see 1.2).

**Effect-AI Implementation Guide:**

Follow the pattern from `OpenAiClient.ts:67-113`:

```typescript
// DedalusClient.ts
export const make = (options: {
  readonly apiKey?: Redacted.Redacted | undefined       // Bearer token
  readonly xApiKey?: Redacted.Redacted | undefined      // X-API-Key header
  readonly apiUrl?: string | undefined
  readonly transformClient?: ((client: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
}): Effect.Effect<Service, never, HttpClient.HttpClient | Scope.Scope> =>
  Effect.gen(function*() {
    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(options.apiUrl ?? "https://api.dedaluslabs.ai/v1"),
          // Dual auth: prefer apiKey, fallback to xApiKey
          options.apiKey
            ? HttpClientRequest.bearerToken(options.apiKey)
            : options.xApiKey
              ? HttpClientRequest.setHeader("x-api-key", Redacted.value(options.xApiKey))
              : identity,
          HttpClientRequest.acceptJson
        )
      ),
      options.transformClient ? options.transformClient : identity
    )
    // ... rest of implementation
  })
```

### 1.2 BYOK Support (Bring Your Own Key)

**Dedalus SDK Pattern** (from `dedalus-sdk-typescript/src/client.ts:778-782`):

BYOK is **separate** from Dedalus authentication. You still need a Dedalus API key, but BYOK headers let you route requests through your own provider credentials:

| Config | Header | Example |
|--------|--------|---------|
| `provider` | `X-Provider` | `"openai"`, `"anthropic"` |
| `providerKey` | `X-Provider-Key` | `"sk-..."` (your OpenAI/Anthropic key) |
| `providerModel` | *(not sent as header)* | Used in request body |

**Headers sent together:**
```
Authorization: Bearer <dedalus-api-key>   # Dedalus auth
X-Provider: openai                         # BYOK provider
X-Provider-Key: sk-...                     # BYOK provider key
```

**Effect-AI Implementation:**

```typescript
interface ByokConfig {
  readonly provider?: string                    // e.g., "openai", "anthropic"
  readonly providerKey?: Redacted.Redacted      // The provider's API key
  readonly providerModel?: string               // e.g., "gpt-4" (used in request body)
}

// In httpClient.mapRequest - BYOK headers are added alongside auth:
HttpClientRequest.setHeaders({
  // Dedalus auth (required)
  ...authHeaders,
  // BYOK (optional, sent if configured)
  ...(options.byok?.provider ? { "X-Provider": options.byok.provider } : {}),
  ...(options.byok?.providerKey ? { "X-Provider-Key": Redacted.value(options.byok.providerKey) } : {}),
})
```

### 1.3 SDK Headers

**Dedalus SDK Pattern** (from `dedalus-sdk-typescript/src/client.ts`):

The SDK automatically sends these headers with every request:

| Header | Value | Purpose |
|--------|-------|---------|
| `Accept` | `application/json` | Content negotiation |
| `User-Agent` | `Dedalus/JS <VERSION>` | Client identification |
| `X-SDK-Version` | `1.0.0` | SDK version tracking |
| `X-Stainless-Retry-Count` | `<count>` | Retry attempt number |
| `X-Stainless-Timeout` | `<seconds>` | Request timeout value |
| `Idempotency-Key` | `<uuid>` | Non-GET request deduplication |

**Effect-AI Implementation:**

```typescript
HttpClient.mapRequest((request) =>
  request.pipe(
    HttpClientRequest.setHeaders({
      "Accept": "application/json",
      "User-Agent": `effect-ai-dedalus/${version}`,
      "X-SDK-Version": "1.0.0",
    }),
    // Add idempotency key for non-GET requests
    request.method !== "GET"
      ? HttpClientRequest.setHeader("Idempotency-Key", yield* Random.randomUUID)
      : identity
  )
)
```

### 1.4 Environmental Switching

**Dedalus SDK Pattern**:
- Production: `https://api.dedaluslabs.ai`
- Development: `http://localhost:8080`

**Effect-AI Implementation:**

```typescript
type DedalusEnvironment = "production" | "development"

const getBaseUrl = (env: DedalusEnvironment): string =>
  env === "production"
    ? "https://api.dedaluslabs.ai/v1"
    : "http://localhost:8080/v1"

// Use Config for environment-aware setup
export const layerConfig = (options: {
  readonly apiKey?: Config.Config<Redacted.Redacted | undefined>
  readonly environment?: Config.Config<DedalusEnvironment>
}): Layer.Layer<DedalusClient, ConfigError, HttpClient.HttpClient> =>
  Config.all(options).pipe(
    Effect.flatMap((configs) => make({
      ...configs,
      apiUrl: getBaseUrl(configs.environment ?? "production")
    })),
    Layer.scoped(DedalusClient)
  )
```

### 1.5 Dedalus-Specific Error Handling

**Dedalus SDK Error Codes** (from `dedalus-sdk-typescript/src/core/error.ts`):

| Status | Error Class | Retryable |
|--------|-------------|-----------|
| 400 | BadRequestError | No |
| 401 | AuthenticationError | No |
| 403 | PermissionDeniedError | No |
| 404 | NotFoundError | No |
| 409 | ConflictError | Yes |
| 422 | UnprocessableEntityError | No |
| 429 | RateLimitError | Yes |
| >=500 | InternalServerError | Yes |

**Effect-AI Implementation:**

Extend `AiError.ts` with Dedalus-specific errors:

```typescript
// DedalusError.ts
import * as Data from "effect/Data"
import * as Match from "effect/Match"

export class DedalusBadRequestError extends Data.TaggedError("DedalusBadRequestError")<{
  readonly status: 400
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusAuthenticationError extends Data.TaggedError("DedalusAuthenticationError")<{
  readonly status: 401
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusPermissionDeniedError extends Data.TaggedError("DedalusPermissionDeniedError")<{
  readonly status: 403
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusNotFoundError extends Data.TaggedError("DedalusNotFoundError")<{
  readonly status: 404
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusConflictError extends Data.TaggedError("DedalusConflictError")<{
  readonly status: 409
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusUnprocessableEntityError extends Data.TaggedError("DedalusUnprocessableEntityError")<{
  readonly status: 422
  readonly message: string
  readonly headers?: Headers
}> {}

export class DedalusRateLimitError extends Data.TaggedError("DedalusRateLimitError")<{
  readonly status: 429
  readonly message: string
  readonly retryAfter?: number
  readonly headers?: Headers
}> {}

export class DedalusInternalServerError extends Data.TaggedError("DedalusInternalServerError")<{
  readonly status: number
  readonly message: string
  readonly headers?: Headers
}> {}

export type DedalusError =
  | DedalusBadRequestError
  | DedalusAuthenticationError
  | DedalusPermissionDeniedError
  | DedalusNotFoundError
  | DedalusConflictError
  | DedalusUnprocessableEntityError
  | DedalusRateLimitError
  | DedalusInternalServerError

// Error mapping function using Effect Match
export const fromHttpStatus = (status: number, body: unknown, headers?: Headers): DedalusError =>
  Match.value(status).pipe(
    Match.when(400, () => new DedalusBadRequestError({
      status: 400,
      message: extractMessage(body),
      headers
    })),
    Match.when(401, () => new DedalusAuthenticationError({
      status: 401,
      message: extractMessage(body),
      headers
    })),
    Match.when(403, () => new DedalusPermissionDeniedError({
      status: 403,
      message: extractMessage(body),
      headers
    })),
    Match.when(404, () => new DedalusNotFoundError({
      status: 404,
      message: extractMessage(body),
      headers
    })),
    Match.when(409, () => new DedalusConflictError({
      status: 409,
      message: extractMessage(body),
      headers
    })),
    Match.when(422, () => new DedalusUnprocessableEntityError({
      status: 422,
      message: extractMessage(body),
      headers
    })),
    Match.when(429, () => new DedalusRateLimitError({
      status: 429,
      message: extractMessage(body),
      retryAfter: parseRetryAfter(headers),
      headers
    })),
    Match.when((s) => s >= 500, () => new DedalusInternalServerError({
      status,
      message: extractMessage(body),
      headers
    })),
    Match.orElse(() => new DedalusInternalServerError({
      status,
      message: extractMessage(body),
      headers
    }))
  )

// Helper to check if error is retryable (for ExecutionPlan `while` predicate)
export const isRetryable = (error: DedalusError): boolean =>
  Match.value(error).pipe(
    Match.tag("DedalusConflictError", () => true),
    Match.tag("DedalusRateLimitError", () => true),
    Match.tag("DedalusInternalServerError", () => true),
    Match.orElse(() => false)
  )
```

### 1.6 Case Conversion (camelCase → snake_case)

**Dedalus SDK Pattern** (from `dedalus-sdk-typescript/src/lib/case-conversion.ts`):

The SDK automatically converts TypeScript camelCase to API snake_case, but **preserves JSON schemas** to avoid breaking schema property names.

| Input | Output | Notes |
|-------|--------|-------|
| `maxTokens` | `max_tokens` | Standard conversion |
| `responseFormat` | `response_format` | Standard conversion |
| `additionalProperties` (in schema) | `additionalProperties` | **Preserved** - not converted |
| `__proto__`, `constructor`, `prototype` | *(skipped)* | Prototype pollution protection |

**Why this matters**: Properties like `additionalProperties` in JSON schemas would break if converted to `additional_properties`.

**Effect-AI Implementation Options:**

1. **Option A**: Send snake_case directly (recommended for simplicity)
2. **Option B**: Implement smart conversion that preserves schema paths

```typescript
// Option A: Use snake_case in request building
const request = {
  model: config.model,
  max_tokens: config.maxTokens,
  response_format: {
    type: "json_schema",
    json_schema: {
      schema: jsonSchema  // Schema properties preserved as-is
    }
  }
}

// Option B: Smart conversion (if needed)
const convertToSnakeCase = (obj: unknown, preservePaths: Array<string>): unknown => {
  // Skip conversion for keys in preservePaths (e.g., "response_format.json_schema.schema")
  // Skip __proto__, constructor, prototype for security
}
```

---

## 2. DedalusLanguageModel - Provider Implementation

### 2.1 Basic Structure

Follow the pattern from `OpenAiLanguageModel.ts`. Key components:

```typescript
// DedalusLanguageModel.ts

export class Config extends Context.Tag("@effect/ai-dedalus/DedalusLanguageModel/Config")<
  Config,
  Config.Service
>() {}

export interface Config.Service {
  readonly model: DedalusModelChoice
  readonly mcpServers?: ReadonlyArray<McpServerSpec>
  readonly modelAttributes?: Record<string, Record<string, number>>
  readonly agentAttributes?: Record<string, number>
  readonly handoffConfig?: unknown
  // ... other Dedalus-specific options
}

export const model = (
  modelSpec: DedalusModelInput,
  config?: Omit<Config.Service, "model">
): AiModel.Model<"dedalus", LanguageModel.LanguageModel, DedalusClient> =>
  AiModel.make("dedalus", layer({ model: normalizeModelSpec(modelSpec), config }))
```

### 2.2 Request Building

The `makeRequest` function should build Dedalus-compatible requests:

```typescript
const makeRequest: (providerOptions: LanguageModel.ProviderOptions) => Effect.Effect<
  DedalusCreateChatCompletionRequest,
  AiError.AiError
> = Effect.fnUntraced(function*(providerOptions) {
  const context = yield* Effect.context<never>()
  const config = context.unsafeMap.get(Config.key)

  return {
    model: config.model,
    messages: yield* prepareMessages(providerOptions),
    tools: yield* prepareTools(providerOptions),
    tool_choice: prepareToolChoice(providerOptions),
    // Dedalus-specific fields
    mcp_servers: config.mcpServers?.map(toApiFormat),
    model_attributes: config.modelAttributes,
    agent_attributes: config.agentAttributes,
    handoff_config: config.handoffConfig,
  }
})
```

---

## 3. MCP Server Integration

### 3.1 API Reference (from `API_REFERENCE.md:552-626`)

Key points:
- MCP servers are specified via `mcp_servers` parameter (string or array)
- Tools are discovered server-side, execution happens server-side
- Response includes `tools_executed` and `mcp_server_errors`

### 3.2 Proposed API Surface

```typescript
// Mcp.ts

// Type definitions
export interface UrlMcpServer {
  readonly _tag: "url"
  readonly url: string
}

export interface MarketplaceMcpServer {
  readonly _tag: "marketplace"
  readonly id: string           // Registry ID or slug like "owner/repo"
}

export type McpServerSpec = UrlMcpServer | MarketplaceMcpServer

// Constructors
export const url = (url: string): McpServerSpec => ({ _tag: "url", url })
export const marketplace = (id: string): McpServerSpec => ({ _tag: "marketplace", id })

// Collection builder
export const make = (servers: Iterable<McpServerSpec>): ReadonlyArray<McpServerSpec> =>
  Array.from(servers)

// Convert to API format
export const toApiFormat = (servers: ReadonlyArray<McpServerSpec>): Array<string> =>
  servers.map(server => server._tag === "url" ? server.url : server.id)
```

### 3.3 Usage Pattern

```typescript
import * as Mcp from "./Mcp"
import * as DedalusLanguageModel from "./DedalusLanguageModel"

const mcpServers = Mcp.make([
  Mcp.url("https://mcp.example.com"),
  Mcp.marketplace("simon-liang/brave-search-mcp"),
  Mcp.marketplace("weather-mcp")
])

const model = DedalusLanguageModel.model("openai/gpt-4", {
  mcpServers
})
```

### 3.4 Response Handling

MCP tool results come back in the response. The `makeResponse` function should handle:

```typescript
// In makeResponse:
const parts: Array<Response.PartEncoded> = []

// Handle MCP tool execution metadata
if (response.tools_executed && response.tools_executed.length > 0) {
  for (const toolName of response.tools_executed) {
    parts.push({
      type: "tool-call",
      id: `mcp-${toolName}`,
      name: toolName,
      params: {},
      providerName: "mcp",
      providerExecuted: true
    })
  }
}

// Handle MCP errors
if (response.mcp_server_errors) {
  for (const [serverId, error] of Object.entries(response.mcp_server_errors)) {
    parts.push({
      type: "error",
      error: { server: serverId, details: error }
    })
  }
}
```

---

## 4. Dynamic Model Routing

### 4.1 API Reference (from `API_REFERENCE.md:629-809`)

Model specification formats:
1. Single string: `"openai/gpt-4"`
2. DedalusModel object: `{ model: "openai/gpt-4", settings: {...} }`
3. Array for routing: `["openai/gpt-4", "anthropic/claude-3-5-sonnet"]`
4. Array with settings: `[{ model: "...", settings: {...} }, ...]`

### 4.2 Proposed API Surface

```typescript
// DedalusModel.ts

export interface ModelSettings {
  readonly temperature?: number
  readonly maxTokens?: number
  readonly topP?: number
  readonly topK?: number
  readonly frequencyPenalty?: number
  readonly presencePenalty?: number
  readonly stop?: string | ReadonlyArray<string>
  readonly seed?: number
  // ... etc
}

export interface DedalusModelSpec {
  readonly model: string
  readonly settings?: ModelSettings
}

export type DedalusModelInput =
  | string
  | DedalusModelSpec
  | ReadonlyArray<string | DedalusModelSpec>

export type DedalusModelChoice =
  | string
  | DedalusModelSpec
  | ReadonlyArray<DedalusModelSpec>

// Normalize input to internal format
export const normalizeModelSpec = (input: DedalusModelInput): DedalusModelChoice => {
  if (typeof input === "string") {
    return input
  }
  if (Array.isArray(input)) {
    return input.map(item =>
      typeof item === "string" ? { model: item } : item
    )
  }
  return input
}
```

### 4.3 Model Constructor Variants

```typescript
// DedalusLanguageModel.ts

// Single model
export const model = (
  modelId: string,
  config?: Omit<Config.Service, "model">
): AiModel.Model<"dedalus", LanguageModel.LanguageModel, DedalusClient>

// Single model with settings
export const modelWithSettings = (
  spec: DedalusModelSpec,
  config?: Omit<Config.Service, "model">
): AiModel.Model<"dedalus", LanguageModel.LanguageModel, DedalusClient>

// Multiple models for routing
export const models = (
  specs: ReadonlyArray<string | DedalusModelSpec>,
  config?: Omit<Config.Service, "model">
): AiModel.Model<"dedalus", LanguageModel.LanguageModel, DedalusClient>
```

### 4.4 Model Attributes for Routing

```typescript
// Usage
const modelWithRouting = DedalusLanguageModel.models(
  ["openai/gpt-4", "anthropic/claude-3-5-sonnet"],
  {
    modelAttributes: {
      "openai/gpt-4": { coding: 0.9, creativity: 0.7, speed: 0.5 },
      "anthropic/claude-3-5-sonnet": { coding: 0.85, creativity: 0.95, speed: 0.8 }
    },
    agentAttributes: {
      coding: 0.2,
      creativity: 0.9
    }
  }
)
```

---

## 5. Dedalus Features via Effect Primitives

### 5.1 Retry, Backoff, and Fallbacks via ExecutionPlan

**ExecutionPlan** is the idiomatic way in effect-ai to handle retries, backoff, delays, and model fallbacks. It replaces the need for manual `Schedule` composition at the HTTP client level.

**Dedalus SDK Pattern** (from `client.ts`):
- Default 2 retries with exponential backoff
- Retries on: 408, 409, 429, 500+
- Initial delay: 0.5s, max delay: 8s
- Jitter: up to 25%

**Effect-AI Implementation via ExecutionPlan:**

```typescript
import * as ExecutionPlan from "@effect/ai/ExecutionPlan"
import * as Schedule from "effect/Schedule"
import * as DedalusLanguageModel from "./DedalusLanguageModel"

// Single model with retry policy (replicates Dedalus retry behavior)
const DedalusPlan = ExecutionPlan.make({
  provide: DedalusLanguageModel.model("openai/gpt-4"),
  attempts: 2,                                           // Default 2 retries
  schedule: Schedule.exponential("500 millis", 2).pipe(  // 500ms base, 2x factor
    Schedule.jittered,                                   // Adds jitter
    Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(8)))  // Max 8s
  ),
  while: (error) =>                                      // Retry on transient errors
    error._tag === "DedalusRateLimitError" ||            // 429
    error._tag === "DedalusConflictError" ||             // 409
    error._tag === "DedalusInternalServerError"          // 500+
})

// Apply the plan to your program
const main = Effect.gen(function*() {
  const response = yield* LanguageModel.generateText({
    prompt: "Hello, world!"
  })
  return response.text
}).pipe(Effect.withExecutionPlan(DedalusPlan))
```

**Multi-Model Fallback with ExecutionPlan:**

For Dedalus model routing, you can use ExecutionPlan for client-side fallbacks while still leveraging Dedalus server-side routing:

```typescript
// Client-side fallback between providers
const MultiProviderPlan = ExecutionPlan.make(
  {
    // Primary: Use Dedalus with server-side model routing
    provide: DedalusLanguageModel.models(
      ["openai/gpt-4", "anthropic/claude-3-5-sonnet"],
      { agentAttributes: { coding: 0.9 } }
    ),
    attempts: 3,
    schedule: Schedule.exponential("500 millis", 2),
    while: (error) => error._tag === "DedalusRateLimitError"
  },
  {
    // Fallback: Direct OpenAI if Dedalus is down
    provide: OpenAiLanguageModel.model("gpt-4o"),
    attempts: 2,
    schedule: Schedule.exponential("100 millis", 1.5),
    while: (error) => error._tag === "HttpResponseError"
  }
)
```

**Key ExecutionPlan Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `provide` | `Layer` | The model/provider layer for this step |
| `attempts` | `number` | Number of retry attempts (default: 1) |
| `schedule` | `Schedule` | Timing between retries (exponential, fixed, etc.) |
| `while` | `(error) => boolean` | Predicate for which errors trigger retry |

**Schedule Combinators for Backoff:**

```typescript
// Exponential backoff: 500ms, 1s, 2s, 4s, 8s (capped)
Schedule.exponential("500 millis", 2).pipe(
  Schedule.jittered,                                    // Add randomness to prevent thundering herd
  Schedule.whileOutput(Duration.lessThanOrEqualTo(Duration.seconds(8)))
)

// Fixed delay with jitter
Schedule.fixed("1 second").pipe(Schedule.jittered)

// Linear backoff: 100ms, 200ms, 300ms...
Schedule.linear("100 millis")
```

### 5.2 State Management (Conversation History)

**Dedalus Runner Pattern**: Maintains `conversationHistory` across steps.

**Effect Implementation** (using Chat module):

```typescript
import * as Chat from "@effect/ai/Chat"
import * as Ref from "effect/Ref"

// The Chat module already provides this:
// - Chat.Service has `history: Ref<Prompt>` for tracking history
// - Auto-appends responses via generateText/streamText
// - Import/export for persistence

// For custom state:
const ConversationState = Context.GenericTag<Ref.Ref<{
  history: Array<Message>
  modelsUsed: Array<string>
  toolsCalled: Array<string>
  stepsUsed: number
}>>("ConversationState")

const trackConversation = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | ConversationState> =>
  Effect.flatMap(ConversationState, (ref) =>
    effect.pipe(
      Effect.tap((response) =>
        Ref.update(ref, (state) => ({
          ...state,
          stepsUsed: state.stepsUsed + 1,
          modelsUsed: [...state.modelsUsed, response.model]
        }))
      )
    )
  )
```

### 5.3 Timeout Configuration

**Dedalus SDK Pattern**: Default 60s timeout, configurable per-request.

**Effect Implementation:**

```typescript
import * as Effect from "effect/Effect"
import * as Duration from "effect/Duration"

// Global timeout via client config
const httpClientWithTimeout = httpClient.pipe(
  HttpClient.timeout(Duration.seconds(60))
)

// Per-request timeout
const requestWithTimeout = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  timeout: Duration.Duration
): Effect.Effect<A, E | TimeoutException, R> =>
  Effect.timeoutFail(effect, {
    duration: timeout,
    onTimeout: () => new TimeoutException()
  })
```

### 5.4 Idempotency Keys

**Dedalus SDK Pattern**: Auto-generates UUID for non-GET requests.

> **Note**: The Dedalus SDK uses plain UUIDs without a prefix. For consistency, use plain UUIDs rather than prefixed ones.

**Effect Implementation:**

```typescript
import * as Random from "effect/Random"

const withIdempotencyKey = (
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<HttpClientRequest.HttpClientRequest> =>
  Effect.map(Random.randomUUID, (uuid) =>
    HttpClientRequest.setHeader(request, "Idempotency-Key", uuid)
  )
```

### 5.5 Structured Concurrency (Max Steps / Turns)

**Dedalus SDK Pattern**: `maxSteps` limits conversation turns.

**Effect Implementation:**

```typescript
// Using Effect.iterate for bounded loops
const runWithMaxSteps = <A, E, R>(
  step: Effect.Effect<A, E, R>,
  maxSteps: number
): Effect.Effect<A, E, R> =>
  Effect.iterate(
    { stepCount: 0, result: undefined as A | undefined },
    {
      while: (state) => state.stepCount < maxSteps && shouldContinue(state.result),
      body: (state) =>
        Effect.map(step, (result) => ({
          stepCount: state.stepCount + 1,
          result
        }))
    }
  ).pipe(Effect.map((state) => state.result!))
```

### 5.6 Resource Management (Scoped Streams)

**Effect Implementation:**

```typescript
// Streaming with proper resource cleanup
const streamWithCleanup = (
  stream: Stream.Stream<Chunk, Error>
): Stream.Stream<Chunk, Error, Scope.Scope> =>
  Stream.unwrapScoped(
    Effect.acquireRelease(
      Effect.succeed(stream),
      () => Effect.log("Stream completed, cleaning up resources")
    )
  )
```

### 5.7 Streaming Tool Call Accumulation

**Dedalus SDK Pattern** (from `dedalus-sdk-typescript/src/lib/runner/streaming.ts`):

When streaming, tool calls arrive as deltas that must be accumulated by index to build complete tool call objects.

**Delta Format:**
```typescript
// Each chunk may contain partial tool call data
{
  choices: [{
    delta: {
      tool_calls: [{
        index: 0,           // Position in array
        id: "call_abc",     // Only in first delta for this index
        type: "function",   // Only in first delta
        function: {
          name: "get_weather",      // Only in first delta
          arguments: "{\"city\":"   // Accumulates across deltas
        }
      }]
    }
  }]
}
```

**Effect-AI Implementation:**

```typescript
import * as Stream from "effect/Stream"

interface ToolCallAccumulator {
  readonly id: string
  readonly type: string
  readonly name: string
  readonly arguments: string
}

// Accumulate tool call deltas by index
const accumulateToolCalls = Stream.mapAccum(
  new Map<number, ToolCallAccumulator>(),
  (acc, chunk) => {
    const deltas = chunk.choices[0]?.delta?.tool_calls ?? []
    for (const delta of deltas) {
      const existing = acc.get(delta.index)
      if (existing) {
        // Append to existing tool call
        acc.set(delta.index, {
          ...existing,
          arguments: existing.arguments + (delta.function?.arguments ?? "")
        })
      } else {
        // New tool call
        acc.set(delta.index, {
          id: delta.id ?? "",
          type: delta.type ?? "function",
          name: delta.function?.name ?? "",
          arguments: delta.function?.arguments ?? ""
        })
      }
    }
    return [acc, chunk]
  }
)

// Extract completed tool calls when stream ends
const extractToolCalls = (acc: Map<number, ToolCallAccumulator>): Array<ToolCallPart> =>
  Array.from(acc.values()).map(tc => ({
    type: "tool-call",
    id: tc.id,
    name: tc.name,
    params: JSON.parse(tc.arguments)
  }))
```

### 5.8 Runner vs Effect Chat Module

**Important**: The Dedalus SDK includes a `DedalusRunner` class (`src/lib/runner/runner.ts`) that handles multi-turn conversations with automatic tool execution.

**You do NOT need to wrap the Runner.** In Effect-AI, this functionality is provided by:

1. **`Chat` module** - Manages conversation history via `Ref<Prompt>`
2. **`ExecutionPlan`** - Handles retries and fallbacks
3. **Tool execution loop** - Built into `LanguageModel.generateText` when tools are provided

The Effect-AI pattern is more composable and doesn't require a separate runner abstraction.

---

## 6. Streaming Structured Output

### 6.1 Current State

| SDK | `generateText` | `generateObject` | `streamText` | `streamObject` |
|-----|----------------|------------------|--------------|----------------|
| effect-ai | Yes | Yes | Yes | **No** |
| Dedalus TS SDK | Yes | Yes (`.parse()`) | Yes | **No** (TODO in tests) |
| Dedalus API | Yes | Yes | Yes | **Yes** (supports `stream: true` + `response_format`) |

**Gap**: The Dedalus API supports streaming with `response_format: { type: 'json_schema', ... }`, but neither SDK exposes this capability.

### 6.2 API-Level Support

Dedalus API allows combining streaming and structured output:

```typescript
// This is valid at the Dedalus API level
const stream = await client.chat.completions.create({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Extract user info from...' }],
  stream: true,
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'user_info',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      },
      strict: true
    }
  }
})

// Stream returns JSON chunks that need to be accumulated and parsed
for await (const chunk of stream) {
  // chunk.choices[0].delta.content contains partial JSON
}
```

### 6.3 Proposed Effect-AI Extension

Add `streamObject` to `LanguageModel.Service`:

```typescript
// In LanguageModel.ts
export interface Service {
  // Existing methods...
  readonly generateText: <...>(...) => Effect<GenerateTextResponse<Tools>, ...>
  readonly generateObject: <...>(...) => Effect<GenerateObjectResponse<Tools, A>, ...>
  readonly streamText: <...>(...) => Stream<StreamPart<Tools>, ...>

  // NEW: Streaming structured output
  readonly streamObject: <
    A,
    I extends Record<string, unknown>,
    R,
    Tools extends Record<string, Tool.Any>,
    Options extends NoExcessProperties<StreamObjectOptions<any, A, I, R>, Options>,
  >(options: Options & StreamObjectOptions<Tools, A, I, R>) => Stream<
    StreamObjectPart<A>,
    ExtractError<Options>,
    R | ExtractContext<Options>
  >
}
```

**StreamObjectPart types:**

```typescript
export type StreamObjectPart<A> =
  | { readonly type: "object-delta"; readonly delta: string }      // Raw JSON chunk
  | { readonly type: "object-partial"; readonly partial: Partial<A> }  // Parsed partial
  | { readonly type: "object"; readonly value: A }                 // Final parsed value
  | Response.FinishPart                                            // Completion metadata
```

### 6.4 Implementation in DedalusLanguageModel

```typescript
// In DedalusLanguageModel.ts
streamObject: Effect.fnUntraced(
  function*(options) {
    const request = yield* makeRequest(options)
    // Add response_format to request
    request.response_format = {
      type: "json_schema",
      json_schema: {
        name: options.objectName ?? "response",
        schema: Tool.getJsonSchemaFromSchemaAst(options.schema.ast),
        strict: true
      }
    }
    request.stream = true
    return client.createCompletionStream(request)
  },
  (effect, options) =>
    effect.pipe(
      Effect.flatMap((stream) => makeStreamObjectResponse(stream, options)),
      Stream.unwrap
    )
)

// Accumulate JSON chunks and emit partial parses
const makeStreamObjectResponse = <A>(
  stream: Stream<SSEEvent>,
  options: { schema: Schema.Schema<A> }
): Stream<StreamObjectPart<A>> =>
  stream.pipe(
    Stream.mapAccum("", (acc, event) => {
      const newAcc = acc + (event.delta?.content ?? "")
      // Try to parse partial JSON
      const partial = tryParsePartial<A>(newAcc)
      return [newAcc, { type: "object-delta", delta: event.delta?.content, partial }]
    }),
    Stream.concat(Stream.make({ type: "object", value: finalParsedValue }))
  )
```

### 6.5 Usage Example

```typescript
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

const UserInfo = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  email: Schema.String
})

const program = Effect.gen(function*() {
  const stream = LanguageModel.streamObject({
    prompt: "Extract user info from: John Doe, 30 years old, john@example.com",
    schema: UserInfo
  })

  yield* stream.pipe(
    Stream.tap((part) => {
      if (part.type === "object-partial") {
        console.log("Partial:", part.partial)  // { name: "John" } → { name: "John", age: 30 } → ...
      }
      if (part.type === "object") {
        console.log("Final:", part.value)  // { name: "John Doe", age: 30, email: "john@example.com" }
      }
    }),
    Stream.runDrain
  )
})
```

---

## Summary: Implementation Checklist

### Phase 1: DedalusClient
- [ ] Implement dual authentication (Bearer + X-API-Key)
- [ ] Add BYOK header support
- [ ] Add SDK headers (X-SDK-Version, User-Agent)
- [ ] Add idempotency key generation for non-GET requests
- [ ] Add environment switching (prod/dev URLs)
- [ ] Implement Dedalus-specific error types (for ExecutionPlan `while` predicates)
- [ ] Handle case conversion (use snake_case directly, preserve JSON schema properties)

### Phase 2: DedalusLanguageModel
- [ ] Create `Config` context tag
- [ ] Implement `model()`, `modelWithSettings()`, `models()` constructors
- [ ] Build request serialization (messages, tools)
- [ ] Build response deserialization
- [ ] Add streaming support via SSE
- [ ] Implement tool call delta accumulation for streaming
- [ ] Add `streamObject` support (see Section 6 - Streaming Structured Output)

### Phase 3: MCP Integration
- [ ] Create `Mcp` module with `url()` and `marketplace()` constructors
- [ ] Add `mcpServers` to Config
- [ ] Handle `tools_executed` in response
- [ ] Handle `mcp_server_errors` in response

### Phase 4: Model Routing
- [ ] Create `DedalusModel` module with normalization
- [ ] Add `modelAttributes` and `agentAttributes` to Config
- [ ] Add `handoffConfig` support
- [ ] Track `modelsUsed` across conversation steps

### Phase 5: ExecutionPlan & Effect Integration
- [ ] Create default `DedalusPlan` with Dedalus retry policy (2 attempts, exponential backoff, jitter)
- [ ] Document ExecutionPlan usage for retries/fallbacks
- [ ] Document Ref usage for state management (via Chat module)
- [ ] Document Scope for resource management

---

## Appendix: Key Differences from Dedalus SDK

| Aspect | Dedalus SDK | Effect-AI Extension |
|--------|-------------|---------------------|
| Multi-turn conversations | `DedalusRunner` class | `Chat` module + tool loop |
| Retry/backoff | HTTP client level | `ExecutionPlan` |
| State management | `RunResult` object | `Ref<Prompt>` in Chat |
| Streaming accumulation | `accumulateToolCalls()` | `Stream.mapAccum` |
| Case conversion | Automatic with schema preservation | Manual (use snake_case) |
| Idempotency keys | Plain UUID | Plain UUID |
