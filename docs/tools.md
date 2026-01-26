# Tools & Toolkits

Tools allow language models to perform actions like calling APIs, querying databases, or executing code.

## Defining a Tool

```typescript
import { Tool } from "@luketandjung/ariadne"
import { Schema } from "effect"

const GetWeather = Tool.make("GetWeather", {
  description: "Get the current weather for a location",
  parameters: {
    location: Schema.String.annotations({
      description: "The city and state, e.g. San Francisco, CA",
    }),
    unit: Schema.optional(Schema.Literal("celsius", "fahrenheit")),
  },
  success: Schema.Struct({
    temperature: Schema.Number,
    condition: Schema.String,
    humidity: Schema.Number,
  }),
  failure: Schema.String,
})
```

## Creating a Toolkit

Group related tools into a toolkit:

```typescript
import { Toolkit } from "@luketandjung/ariadne"

const WeatherToolkit = Toolkit.make(GetWeather, GetForecast)
```

## Implementing Tool Handlers

```typescript
const WeatherToolkitLive = WeatherToolkit.toLayer({
  GetWeather: ({ location, unit }) =>
    Effect.gen(function* () {
      // Call your weather API here
      const data = yield* fetchWeatherApi(location)
      return {
        temperature: unit === "celsius" ? data.tempC : data.tempF,
        condition: data.condition,
        humidity: data.humidity,
      }
    }),
  GetForecast: ({ location, days }) =>
    Effect.succeed([/* forecast data */]),
})
```

## Using Tools with Language Model

```typescript
const program = LanguageModel.generateText({
  prompt: "What's the weather like in Tokyo?",
  toolkit: WeatherToolkit,
})

const result = await program.pipe(
  Effect.provide(WeatherToolkitLive),
  Effect.provide(Gpt4o),
  Effect.provide(Dedalus),
  Effect.runPromise,
)

// The model will call GetWeather, and you'll get both
// the tool results and the final text response
console.log(result.toolResults) // [{ name: "GetWeather", result: {...} }]
console.log(result.text)        // "The weather in Tokyo is..."
```

## Tool Choice

Control which tools the model can use:

```typescript
// Let the model decide (default)
toolChoice: "auto"

// Force tool use
toolChoice: "required"

// No tools
toolChoice: "none"

// Force a specific tool
toolChoice: { tool: "GetWeather" }

// Allow only certain tools
toolChoice: { mode: "auto", oneOf: ["GetWeather", "GetForecast"] }
```

## Disabling Automatic Tool Resolution

By default, tools are automatically executed. To disable this:

```typescript
const response = yield* LanguageModel.generateText({
  prompt: "What's the weather?",
  toolkit: WeatherToolkit,
  disableToolCallResolution: true,
})

// Now you handle tool execution yourself
for (const toolCall of response.toolCalls) {
  console.log(toolCall.name, toolCall.params)
}
```

## Tool Concurrency

Control parallel tool execution:

```typescript
LanguageModel.generateText({
  prompt: "...",
  toolkit: MyToolkit,
  concurrency: 5,  // Max 5 tools in parallel
})
```

## Tool Annotations

Add metadata to tools:

```typescript
const ReadOnlyTool = Tool.make("FetchData", {
  description: "Fetch data from API",
  success: Schema.Unknown,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.Title, "Data Fetcher")
```

Available annotations:
- `Tool.Readonly` - Tool doesn't modify state
- `Tool.Destructive` - Tool performs destructive operations
- `Tool.Idempotent` - Tool can be safely retried
- `Tool.OpenWorld` - Tool handles arbitrary external data
- `Tool.Title` - Human-readable title

## Tool with Dependencies

Tools can depend on Effect services:

```typescript
const DatabaseQuery = Tool.make("DatabaseQuery", {
  description: "Query the database",
  parameters: { query: Schema.String },
  success: Schema.Array(Schema.Unknown),
})

const DatabaseToolkitLive = Toolkit.make(DatabaseQuery).toLayer(
  Effect.gen(function* () {
    const db = yield* DatabaseService  // Access your service
    return {
      DatabaseQuery: ({ query }) => db.execute(query),
    }
  }),
)
```

## Failure Modes

Control how tool errors are handled:

```typescript
// Error mode (default) - tool errors propagate as Effect failures
const ErrorTool = Tool.make("ErrorTool", {
  failureMode: "error",
  // ...
})

// Return mode - errors are caught and returned as tool results
const SafeTool = Tool.make("SafeTool", {
  failureMode: "return",
  success: SomeType,
  failure: ErrorType,  // This will be returned, not thrown
})
```

## Next Steps

- [Agent Runner](./agent-runner.md) - Enable multi-turn agentic loops with tools
- [Chat](./chat.md) - Use tools in multi-turn conversations
- [MCP Servers](./mcp.md) - Use hosted MCP tools
- [Execution Planning](./execution-planning.md) - Handle tool failures with retries
