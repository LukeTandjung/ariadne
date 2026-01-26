# API Reference

## @luketandjung/ariadne Exports

### Modules

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

### LanguageModel

```typescript
// Service tag
class LanguageModel extends Context.Tag<LanguageModel, Service>

// Methods
LanguageModel.generateText(options: GenerateTextOptions): Effect<GenerateTextResponse>
LanguageModel.generateObject(options: GenerateObjectOptions): Effect<GenerateObjectResponse>
LanguageModel.streamText(options: GenerateTextOptions): Stream<StreamPart>
LanguageModel.streamObject(options: GenerateObjectOptions): Stream<StreamObjectPart>
```

#### GenerateTextOptions

```typescript
interface GenerateTextOptions<Tools> {
  prompt: Prompt.RawInput
  system?: string
  toolkit?: Toolkit<Tools> | Effect<Toolkit<Tools>>
  toolChoice?: ToolChoice<Tools>
  concurrency?: Concurrency
  disableToolCallResolution?: boolean
  mcpServers?: Array<McpRegistry.McpServerSpec>
}
```

#### GenerateObjectOptions

```typescript
interface GenerateObjectOptions<Tools, A, I, R> extends GenerateTextOptions<Tools> {
  schema: Schema.Schema<A, I, R>
  objectName?: string
}
```

### Chat

```typescript
// Service tag
class Chat extends Context.Tag<Chat, Service>

// Constructors
Chat.empty: Effect<Chat.Service>
Chat.fromPrompt(prompt: Prompt.RawInput): Effect<Chat.Service>
Chat.fromExport(data: unknown): Effect<Chat.Service>
Chat.fromJson(json: string): Effect<Chat.Service>

// Persistence
Chat.Persistence: Context.Tag<Persistence, Persistence.Service>
Chat.makePersisted(options: { storeId: string }): Effect<Persistence.Service>
Chat.layerPersisted(options): Layer<Persistence>
```

#### Chat.Service

```typescript
interface Service {
  history: Ref<Prompt>
  export: Effect<unknown>
  exportJson: Effect<string>
  generateText(options): Effect<GenerateTextResponse>
  generateObject(options): Effect<GenerateObjectResponse>
  streamText(options): Stream<StreamPart>
}
```

### Tool

```typescript
// Create user-defined tool
Tool.make(name: string, options: ToolOptions): Tool

// Create provider-defined tool
Tool.providerDefined(options): ProviderDefinedTool

// From Effect TaggedRequest
Tool.fromTaggedRequest(schema): Tool

// Utilities
Tool.getJsonSchema(tool): JsonSchema
Tool.getDescription(tool): string | undefined
Tool.isUserDefined(tool): boolean
Tool.isProviderDefined(tool): boolean
Tool.unsafeSecureJsonParse(json: string): unknown

// Annotations
Tool.Title: Context.Tag<string>
Tool.Readonly: Context.Tag<boolean>
Tool.Destructive: Context.Tag<boolean>
Tool.Idempotent: Context.Tag<boolean>
Tool.OpenWorld: Context.Tag<boolean>
```

### Toolkit

```typescript
// Create toolkit from tools
Toolkit.make(...tools: Array<Tool>): Toolkit

// Empty toolkit
Toolkit.empty: Toolkit

// Instance methods
toolkit.toLayer(handlers): Layer
toolkit.of(handlers): handlers
toolkit.toContext(handlers): Effect<Context>
```

### McpRegistry

```typescript
// Constructors
McpRegistry.marketplace(id: string): McpServerSpec
McpRegistry.url(url: string): McpServerSpec
McpRegistry.make(servers: Iterable<McpServerSpec>): Array<McpServerSpec>

// Utilities
McpRegistry.toApiFormat(servers): Array<string>
McpRegistry.isUrl(server): server is UrlMcpServer
McpRegistry.isMarketplace(server): server is MarketplaceMcpServer
```

### Prompt

```typescript
// Create prompt
Prompt.make(input: RawInput): Prompt
Prompt.empty: Prompt

// Combine prompts
Prompt.merge(p1: Prompt, p2: Prompt): Prompt

// From response
Prompt.fromResponseParts(parts: Array<Part>): Prompt

// Part constructors
Prompt.makePart("text", { text }): TextPart
Prompt.makePart("file", { mediaType, fileName, data }): FilePart
Prompt.makePart("reasoning", { text }): ReasoningPart
Prompt.makePart("tool-call", { id, name, params }): ToolCallPart
Prompt.makePart("tool-result", { id, result, isFailure }): ToolResultPart
```

### AiError

```typescript
// Error types
class HttpRequestError extends Data.TaggedError("HttpRequestError")
class HttpResponseError extends Data.TaggedError("HttpResponseError")
class MalformedInput extends Data.TaggedError("MalformedInput")
class MalformedOutput extends Data.TaggedError("MalformedOutput")
class UnknownError extends Data.TaggedError("UnknownError")

// Union type
type AiError = HttpRequestError | HttpResponseError | MalformedInput | MalformedOutput | UnknownError
```

---

## @luketandjung/dedalus-labs Exports

### Modules

| Module | Description |
|--------|-------------|
| `DedalusClient` | HTTP client for Dedalus API |
| `DedalusLanguageModel` | Language model implementation |
| `DedalusEmbeddingModel` | Embedding model implementation |
| `DedalusConfig` | Client configuration |
| `Generated` | Auto-generated API types |

### DedalusClient

```typescript
// Service tag
class DedalusClient extends Context.Tag<DedalusClient, Service>

// Constructors
DedalusClient.make(options): Effect<Service>
DedalusClient.layer(options): Layer<DedalusClient>
DedalusClient.layerConfig(options): Layer<DedalusClient, ConfigError>
```

#### Options

```typescript
interface Options {
  apiKey?: Redacted.Redacted
  xApiKey?: Redacted.Redacted
  provider?: string
  providerKey?: Redacted.Redacted
  environment?: "production" | "development"
  apiUrl?: string
  transformClient?: (client: HttpClient) => HttpClient
}
```

### DedalusLanguageModel

```typescript
// Create model
DedalusLanguageModel.model(
  model: string | Array<string>,
  config?: Config.Service
): Model<"dedalus-labs", LanguageModel, DedalusClient>

// Layer
DedalusLanguageModel.layer(options): Layer<LanguageModel, never, DedalusClient>

// Configuration override
DedalusLanguageModel.withConfigOverride(
  overrides: Config.Service,
  effect: Effect<A, E, R>
): Effect<A, E, R>

// Also available as pipeable
DedalusLanguageModel.withConfigOverride(
  overrides: Config.Service
): <A, E, R>(effect: Effect<A, E, R>) => Effect<A, E, R>
```

### DedalusEmbeddingModel

```typescript
// Create model
DedalusEmbeddingModel.model(
  model: string,
  options?: { mode?: "batched" | "data-loader"; window?: DurationInput }
): Model<"dedalus-labs", EmbeddingModel, DedalusClient>

// Layer
DedalusEmbeddingModel.layer(options): Layer<EmbeddingModel, never, DedalusClient>

// Configuration override
DedalusEmbeddingModel.withConfigOverride(
  overrides: Config.Service,
  effect: Effect<A, E, R>
): Effect<A, E, R>
```

---

## Response Types

### Part Types

```typescript
type Part =
  | TextPart
  | ReasoningPart
  | FilePart
  | ToolCallPart
  | ToolResultPart
  | ResponseMetadataPart
  | FinishPart
  | SourcePart
```

### StreamPart Types

```typescript
type StreamPart =
  | TextDeltaPart
  | ToolParamsStartPart
  | ToolParamsDeltaPart
  | ToolParamsEndPart
  | ToolCallPart
  | ToolResultPart
  | ResponseMetadataPart
  | FinishPart
  | ErrorPart
```

### StreamObjectPart Types

```typescript
type StreamObjectPart<A> =
  | ObjectDeltaPart
  | ObjectDonePart<A>
  | ResponseMetadataPart
  | FinishPart
  | ErrorPart
```

### Usage

```typescript
interface Usage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  cachedInputTokens?: number
}
```

### FinishReason

```typescript
type FinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "unknown"
```
