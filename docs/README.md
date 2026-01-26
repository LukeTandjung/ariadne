# Ariadne SDK Documentation

Ariadne is a composable, type-safe agent SDK built on [Effect](https://effect.website) that provides a unified interface for building AI-powered applications. It combines the elegant API design of Effect-AI with [Dedalus Labs](https://dedaluslabs.ai)' infrastructure for routing, MCP server hosting, and multi-provider support.

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./getting-started.md) | Installation, setup, and your first program |
| [Language Model](./language-model.md) | Text generation, structured outputs, streaming |
| [Tools & Toolkits](./tools.md) | Define and implement tool calling |
| [Agent Runner](./agent-runner.md) | Multi-turn agentic loops with tools |
| [Chat](./chat.md) | Stateful multi-turn conversations |
| [MCP Servers](./mcp.md) | Model Context Protocol integration |
| [Execution Planning](./execution-planning.md) | Retries, fallbacks, and resilience |
| [Embeddings](./embeddings.md) | Vector embeddings for semantic search |
| [Configuration](./configuration.md) | Client and model configuration options |
| [Error Handling](./error-handling.md) | Error types and handling patterns |
| [API Reference](./api-reference.md) | Complete API reference |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Application                      │
├─────────────────────────────────────────────────────────┤
│                  @luketandjung/ariadne (Core)                    │
│  LanguageModel │ AgentRunner │ Chat │ Tool │ Toolkit   │
├─────────────────────────────────────────────────────────┤
│               @luketandjung/dedalus-labs (Provider)              │
│    DedalusLanguageModel │ DedalusClient │ Config        │
├─────────────────────────────────────────────────────────┤
│                  Dedalus Labs API                        │
│    OpenAI │ Anthropic │ MCP Servers │ Model Routing     │
└─────────────────────────────────────────────────────────┘
```

## Key Features

- **Provider Agnostic**: Write AI logic once, swap providers at runtime
- **Full Type Safety**: Comprehensive TypeScript types for all operations
- **Composable**: Build complex workflows from simple, testable pieces
- **Streaming First**: Native support for streaming text and structured outputs
- **Tool Calling**: Type-safe tool definitions with automatic schema generation
- **MCP Integration**: Connect to hosted MCP servers from the Dedalus marketplace
- **Execution Planning**: Built-in retry, fallback, and resilience patterns
- **Observability**: Built-in OpenTelemetry support for tracing and metrics
