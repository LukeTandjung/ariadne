# Chat

The `Chat` module provides **stateful conversation management** for multi-turn interactions with language models.

## Why Use Chat?

When using `LanguageModel.generateText()` directly, each call is independent - the model has no memory of previous messages. You'd need to manually build and pass the full conversation history each time.

`Chat` solves this by:
- Automatically maintaining conversation history across calls
- Providing the same API as `LanguageModel` (`generateText`, `streamText`, `generateObject`)
- Supporting export/import for persistence
- Offering built-in persistence integration

## Complete Example

```typescript
import { Chat, LanguageModel } from "@luketandjung/ariadne"
import { DedalusClient, DedalusLanguageModel } from "@luketandjung/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer } from "effect"
import * as Redacted from "effect/Redacted"

// 1. Set up the client and model
const Dedalus = DedalusClient.layer({
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))

const Gpt4o = DedalusLanguageModel.model("openai/gpt-4o")

// 2. Use Chat for stateful conversations
const program = Effect.gen(function* () {
  const chat = yield* Chat.empty

  // First message
  const r1 = yield* chat.generateText({
    prompt: "My name is Alice. What's the capital of France?",
  })
  console.log(r1.text) // "The capital of France is Paris."

  // Second message - the model remembers the conversation!
  const r2 = yield* chat.generateText({
    prompt: "What's my name?",
  })
  console.log(r2.text) // "Your name is Alice."
})

// 3. Run with model and client
program.pipe(
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

## Creating a Chat

### Empty Chat

```typescript
const chat = yield* Chat.empty
```

### With System Prompt

Use `Chat.fromPrompt` to initialize with a system message or existing history:

```typescript
const chat = yield* Chat.fromPrompt([
  {
    role: "system",
    content: "You are a pirate. Respond in pirate speak.",
  },
])

const response = yield* chat.generateText({
  prompt: "Hello!",
})
// "Ahoy there, matey! What brings ye to these waters?"
```

### From Existing History

```typescript
const chat = yield* Chat.fromPrompt([
  { role: "user", content: [{ type: "text", text: "What's 2+2?" }] },
  { role: "assistant", content: [{ type: "text", text: "4" }] },
])

// Continue from where you left off
const response = yield* chat.generateText({
  prompt: "Multiply that by 10",
})
// "40"
```

## Chat Methods

`Chat.Service` mirrors `LanguageModel` but maintains history automatically:

```typescript
interface Chat.Service {
  history: Ref<Prompt>                    // Direct access to conversation history
  export: Effect<unknown>                  // Export history as structured data
  exportJson: Effect<string>               // Export history as JSON string
  generateText(options): Effect<Response>  // Generate with history
  generateObject(options): Effect<Response> // Structured output with history
  streamText(options): Stream<StreamPart>  // Streaming with history
}
```

## Using Tools with Chat

Tool calls and results are preserved in history:

```typescript
const chat = yield* Chat.empty

const response = yield* chat.generateText({
  prompt: "What's the weather in Tokyo?",
  toolkit: WeatherToolkit,
})

// The model remembers the tool call happened
const followUp = yield* chat.generateText({
  prompt: "What about tomorrow?",
  toolkit: WeatherToolkit,
})
```

## Streaming

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

// History is updated after stream completes
```

## Exporting and Restoring

### Export to JSON

```typescript
const json = yield* chat.exportJson

// Save to database, file, localStorage, etc.
await saveToDatabase(userId, json)
```

### Restore from JSON

```typescript
const savedJson = await loadFromDatabase(userId)

const restoredChat = yield* Chat.fromJson(savedJson)

// Continue the conversation with full history
const response = yield* restoredChat.generateText({
  prompt: "What were we talking about?",
})
```

### Export Formats

```typescript
// Structured export (for programmatic use)
const data = yield* chat.export
const restored = yield* Chat.fromExport(data)

// JSON string (for storage)
const json = yield* chat.exportJson
const restored = yield* Chat.fromJson(json)
```

## Built-in Persistence

For automatic persistence with a backing store (using `@effect/experimental/Persistence`):

```typescript
import { BackingPersistence } from "@effect/experimental/Persistence"

const program = Effect.gen(function* () {
  const persistence = yield* Chat.Persistence

  // Get existing chat or create new one
  const chat = yield* persistence.getOrCreate("user-123-session", {
    timeToLive: Duration.days(7),
  })

  // All messages are automatically persisted after each call
  yield* chat.generateText({ prompt: "Hello!" })

  // Manual save if needed
  yield* chat.save
})

program.pipe(
  Effect.provide(Chat.layerPersisted({ storeId: "my-chats" })),
  Effect.provide(yourBackingPersistenceLayer),
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

### Persistence API

```typescript
interface Chat.Persistence.Service {
  // Get existing chat (fails with ChatNotFoundError if not found)
  get(chatId: string, options?): Effect<Persisted, ChatNotFoundError>

  // Get or create new chat
  getOrCreate(chatId: string, options?): Effect<Persisted>
}

interface Persisted extends Chat.Service {
  id: string              // Chat ID
  save: Effect<void>      // Manual save
}
```

## Accessing History Directly

```typescript
import { Ref } from "effect"

const chat = yield* Chat.empty

// Read current history
const currentHistory = yield* Ref.get(chat.history)
console.log(currentHistory.content)  // Array of messages

// Manually modify history (advanced use case)
yield* Ref.update(chat.history, (prompt) =>
  Prompt.merge(prompt, additionalMessages)
)
```

## Next Steps

- [Tools & Toolkits](./tools.md) - Add tools to chat
- [MCP Servers](./mcp.md) - Add MCP tools to chat
- [Execution Planning](./execution-planning.md) - Handle failures in chat
