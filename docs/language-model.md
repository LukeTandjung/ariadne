# Language Model

The `LanguageModel` module provides the core interface for text generation, structured outputs, and streaming.

## Text Generation

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

### Stream Parts Reference

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

## Next Steps

- [Tools & Toolkits](./tools.md) - Add tool calling capabilities
- [Chat](./chat.md) - Maintain conversation history
- [Execution Planning](./execution-planning.md) - Add retries and fallbacks
