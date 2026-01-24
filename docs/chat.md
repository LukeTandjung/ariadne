# Chat

The `Chat` module manages conversation history automatically for multi-turn interactions.

## Creating a Chat

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

## Chat with System Prompt

```typescript
const chat = yield* Chat.fromPrompt([
  {
    role: "system",
    content: "You are a helpful coding assistant.",
  },
])

yield* chat.generateText({ prompt: "Help me write a function" })
```

## Chat Methods

The `Chat.Service` provides the same methods as `LanguageModel`, but with automatic history management:

```typescript
interface Chat.Service {
  history: Ref<Prompt>                    // Access conversation history
  generateText(options): Effect<...>       // Generate with history
  generateObject(options): Effect<...>     // Structured output with history
  streamText(options): Stream<...>         // Streaming with history
  export: Effect<unknown>                  // Export history
  exportJson: Effect<string>               // Export as JSON
}
```

## Using Tools with Chat

```typescript
const chat = yield* Chat.empty

const response = yield* chat.generateText({
  prompt: "What's the weather in Tokyo?",
  toolkit: WeatherToolkit,
})

// Tool calls and results are preserved in history
const followUp = yield* chat.generateText({
  prompt: "What about tomorrow?",
  toolkit: WeatherToolkit,
})
```

## Streaming with Chat

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
// Export conversation
const json = yield* chat.exportJson

// Save to database, file, etc.
await saveToDatabase(userId, json)
```

### Restore from JSON

```typescript
// Load from storage
const savedJson = await loadFromDatabase(userId)

// Restore chat with full history
const restoredChat = yield* Chat.fromJson(savedJson)

// Continue the conversation
const response = yield* restoredChat.generateText({
  prompt: "What were we talking about?",
})
```

### Export/Import Formats

```typescript
// Structured export (for programmatic use)
const data = yield* chat.export
const restored = yield* Chat.fromExport(data)

// JSON string (for storage)
const json = yield* chat.exportJson
const restored = yield* Chat.fromJson(json)
```

## Persistent Chat

For automatic persistence with a backing store:

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

  // Manual save if needed
  yield* chat.save()
})

// Provide backing persistence
program.pipe(
  Effect.provide(Chat.layerPersisted({ storeId: "chats" })),
  Effect.provide(yourPersistenceLayer),
)
```

### Persistence Methods

```typescript
interface Chat.Persistence.Service {
  // Get existing chat (fails if not found)
  get(chatId: string, options?): Effect<Persisted, ChatNotFoundError>

  // Get or create new chat
  getOrCreate(chatId: string, options?): Effect<Persisted>
}

interface Persisted extends Chat.Service {
  id: string                              // Chat ID
  save(): Effect<void>                    // Manual save
}
```

## Accessing History

```typescript
import { Ref } from "effect"

const chat = yield* Chat.empty

// Read current history
const currentHistory = yield* Ref.get(chat.history)
console.log(currentHistory.content)  // Array of messages

// Manually modify history (advanced)
yield* Ref.update(chat.history, (prompt) =>
  Prompt.merge(prompt, additionalMessages)
)
```

## Next Steps

- [MCP Servers](./mcp.md) - Add MCP tools to chat
- [Execution Planning](./execution-planning.md) - Handle failures in chat
- [Configuration](./configuration.md) - Configure model behavior
