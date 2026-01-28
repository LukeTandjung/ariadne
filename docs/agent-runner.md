# Agent Runner

The `AgentRunner` module provides agentic loop capabilities for AI language models, enabling multi-turn inference where the model can iteratively call tools and receive results until it produces a final answer.

## Overview

When you add tools to a language model request, the model might decide to call those tools. By default, `LanguageModel` executes tool calls and returns the results in a single turn. However, many agentic workflows require **multiple turns** where:

1. The model analyzes the current state
2. Decides to call one or more tools
3. Receives tool results
4. Continues reasoning or calls more tools
5. Eventually produces a final answer

The `AgentRunner.ReAct` layer enables this multi-turn loop pattern.

## Basic Usage

```typescript
import { AgentRunner, LanguageModel, Toolkit, Tool } from "@luketandjung/ariadne"
import { Effect, Schema } from "effect"

// Define tools
const SearchWeb = Tool.make("SearchWeb", {
  description: "Search the web for information",
  parameters: { query: Schema.String },
  success: Schema.String,
})

const GetWeather = Tool.make("GetWeather", {
  description: "Get current weather for a location",
  parameters: { location: Schema.String },
  success: Schema.Struct({
    temperature: Schema.Number,
    condition: Schema.String,
  }),
})

const ResearchToolkit = Toolkit.make(SearchWeb, GetWeather)

// Use LanguageModel as usual
const program = LanguageModel.generateText({
  prompt: "Research the weather in Tokyo and find related news articles",
  toolkit: ResearchToolkit,
})

// Add AgentRunner.ReAct to enable multi-turn loop
const MainLayer = ResearchToolkitLive.pipe(
  Layer.provide(AgentRunner.ReAct),
  Layer.provide(AgentRunner.defaultConfig),
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

const result = await program.pipe(
  Effect.provide(MainLayer),
  Effect.runPromise,
)

// The model may have called multiple tools across several turns
console.log(result.toolResults) // All tool results from all turns
console.log(result.text)        // Final synthesized response
```

## How It Works

The `AgentRunner.ReAct` layer intercepts `LanguageModel` calls and runs them in a loop:

```
┌──────────────────────────────────────────────────────────┐
│                    Your Application                       │
│                                                          │
│  LanguageModel.generateText({ prompt, toolkit })         │
│                         │                                │
│                         ▼                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │              AgentRunner.ReAct Layer               │  │
│  │                                                    │  │
│  │  Turn 1: Model → "I need to search for..."        │  │
│  │          Tool: SearchWeb("Tokyo weather news")     │  │
│  │          Result: "Article about..."               │  │
│  │                                                    │  │
│  │  Turn 2: Model → "Now let me get the weather..."  │  │
│  │          Tool: GetWeather("Tokyo")                 │  │
│  │          Result: { temperature: 22, ... }          │  │
│  │                                                    │  │
│  │  Turn 3: Model → "Based on my research..."        │  │
│  │          finishReason: "stop" (no more tools)     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                         │                                │
│                         ▼                                │
│              Final Response (all turns combined)         │
└──────────────────────────────────────────────────────────┘
```

## Configuration

### Default Configuration

```typescript
import { AgentRunner } from "@luketandjung/ariadne"

program.pipe(
  Effect.provide(AgentRunner.defaultConfig),  // maxTurns: 10
)
```

### Custom Configuration

```typescript
import { AgentRunner } from "@luketandjung/ariadne"
import { Layer } from "effect"

// Set a custom maximum number of turns
const customConfig = Layer.succeed(AgentRunner.Config, {
  maxTurns: 20,
})

const AgentLayer = AgentRunner.ReAct.pipe(Layer.provide(customConfig))

program.pipe(Effect.provide(AgentLayer))
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTurns` | `number` | `10` | Maximum inference turns before stopping the loop |

## Loop Termination

The ReAct loop terminates when any of these conditions are met:

| Condition | Description |
|-----------|-------------|
| `finishReason: "stop"` | Model produced a response without tool calls |
| `finishReason: "length"` | Model hit a token limit |
| `finishReason: "content-filter"` | Content was filtered |
| `finishReason: "error"` | An error occurred |
| Maximum turns reached | Configured `maxTurns` limit was hit |

## Streaming with AgentRunner

The ReAct loop also works with streaming:

```typescript
const stream = LanguageModel.streamText({
  prompt: "Research and summarize AI trends",
  toolkit: ResearchToolkit,
})

const MainLayer = ResearchToolkitLive.pipe(
  Layer.provide(AgentRunner.ReAct),
  Layer.provide(AgentRunner.defaultConfig),
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

yield* stream.pipe(
  Effect.provide(MainLayer),
  Stream.tap((part) =>
    Effect.sync(() => {
      switch (part.type) {
        case "text-delta":
          process.stdout.write(part.delta)
          break
        case "tool-call":
          console.log(`\n[Tool: ${part.name}]`)
          break
        case "tool-result":
          console.log(`[Result received]`)
          break
        case "finish":
          console.log(`\n[Turn finished: ${part.reason}]`)
          break
      }
    }),
  ),
  Stream.runDrain,
)
```

In streaming mode, you'll see parts from all turns as they happen. Each turn's finish part indicates whether the loop will continue.

## Structured Outputs with AgentRunner

You can combine structured output generation with the agentic loop:

```typescript
import { Schema } from "effect"

const ReportSchema = Schema.Struct({
  title: Schema.String,
  summary: Schema.String,
  sources: Schema.Array(Schema.String),
  confidence: Schema.Number,
})

const program = LanguageModel.generateObject({
  prompt: "Research quantum computing advances and create a report",
  schema: ReportSchema,
  toolkit: ResearchToolkit,
})

const MainLayer = ResearchToolkitLive.pipe(
  Layer.provide(AgentRunner.ReAct),
  Layer.provide(AgentRunner.defaultConfig),
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

const result = await program.pipe(
  Effect.provide(MainLayer),
  Effect.runPromise,
)

// The model researched using tools, then produced a structured report
console.log(result.value)
// {
//   title: "Quantum Computing in 2024",
//   summary: "Based on recent research...",
//   sources: ["https://...", "https://..."],
//   confidence: 0.85
// }
```

## MCP Server Integration

AgentRunner works seamlessly with MCP (Model Context Protocol) servers:

```typescript
import { McpRegistry } from "@luketandjung/ariadne"

const program = LanguageModel.generateText({
  prompt: "Search for Effect TypeScript tutorials",
  toolkit: LocalToolkit,
  mcpServers: [
    McpRegistry.marketplace("dedalus-labs/brave-search"),
  ],
})

const MainLayer = LocalToolkitLive.pipe(
  Layer.provide(AgentRunner.ReAct),
  Layer.provide(AgentRunner.defaultConfig),
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

const result = await program.pipe(
  Effect.provide(MainLayer),
  Effect.runPromise,
)
```

MCP tools execute server-side, and the loop continues based on whether there are additional local tool calls to process.

## Comparison: With vs Without AgentRunner

### Without AgentRunner (Single Turn)

```typescript
const MainLayer = ResearchToolkitLive.pipe(
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

const result = await LanguageModel.generateText({
  prompt: "Research Tokyo weather and find news",
  toolkit: ResearchToolkit,
}).pipe(
  Effect.provide(MainLayer),
  Effect.runPromise,
)

// Model calls tools once, you get results from that single turn
// If the model needs more information, it can't continue
```

### With AgentRunner (Multi-Turn Loop)

```typescript
const MainLayer = ResearchToolkitLive.pipe(
  Layer.provide(AgentRunner.ReAct),        // Add AgentRunner
  Layer.provide(AgentRunner.defaultConfig),
  Layer.provide(Gpt4o),
  Layer.provide(Dedalus),
)

const result = await LanguageModel.generateText({
  prompt: "Research Tokyo weather and find news",
  toolkit: ResearchToolkit,
}).pipe(
  Effect.provide(MainLayer),
  Effect.runPromise,
)

// Model can call tools multiple times across turns
// Loop continues until model produces a final answer
// You get aggregated results from all turns
```

## Best Practices

### 1. Set Appropriate maxTurns

Choose a `maxTurns` value based on your use case:

```typescript
// Simple tasks: fewer turns
const simpleConfig = Layer.succeed(AgentRunner.Config, { maxTurns: 5 })

// Complex research: more turns
const researchConfig = Layer.succeed(AgentRunner.Config, { maxTurns: 25 })
```

### 2. Design Clear Tool Descriptions

The model decides when to stop based on its assessment. Clear tool descriptions help:

```typescript
const GoodTool = Tool.make("AnalyzeData", {
  description: "Analyze a dataset and return insights. Use this when you need to understand patterns in data.",
  // ...
})
```

### 3. Handle Long-Running Agents

For agents that might run for a while, consider adding timeouts:

```typescript
const AgentLayer = AgentRunner.ReAct.pipe(Layer.provide(AgentRunner.defaultConfig))

const result = await program.pipe(
  Effect.provide(AgentLayer),
  Effect.timeout("5 minutes"),
  Effect.runPromise,
)
```

### 4. Monitor Token Usage

Each turn consumes tokens. The final response includes aggregated usage:

```typescript
const AgentLayer = AgentRunner.ReAct.pipe(
  Layer.provide(AgentRunner.defaultConfig),
  // ... other layers
)

const result = await program.pipe(
  Effect.provide(AgentLayer),
  Effect.runPromise,
)

console.log(result.usage.totalTokens)  // Total across all turns
```

## Next Steps

- [Tools & Toolkits](./tools.md) - Define custom tools for your agent
- [MCP Servers](./mcp.md) - Connect to hosted MCP tools
- [Chat](./chat.md) - Maintain conversation history across agent runs
- [Execution Planning](./execution-planning.md) - Add retries and fallbacks
