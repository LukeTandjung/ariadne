# Dedalus Labs SDK - API Reference

This document provides comprehensive documentation for the three core API endpoints in the Dedalus Labs TypeScript SDK, along with detailed explanations of MCP server integration and model routing.

---

## Table of Contents

1. [Chat Completions API](#1-chat-completions-api)
2. [Embeddings API](#2-embeddings-api)
3. [Models API](#3-models-api)
4. [Error Handling](#4-error-handling)
5. [MCP Server Integration](#5-mcp-server-integration)
6. [Model Routing & Handoff](#6-model-routing--handoff)

---

## 1. Chat Completions API

### `client.chat.completions.create()`

Generates a model response for a given conversation. Supports both streaming and non-streaming responses.

### Basic Usage

```typescript
import Dedalus from 'dedalus-labs';

const client = new Dedalus({ apiKey: process.env.DEDALUS_API_KEY });

// Non-streaming
const completion = await client.chat.completions.create({
  model: 'openai/gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ]
});

console.log(completion.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Request Parameters

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `string \| DedalusModel \| Array<DedalusModelChoice>` | Model identifier. Accepts a single model ID string, a `DedalusModel` object with settings, or an array for multi-model routing. |

#### Message Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `messages` | `Array<Message>` | Conversation history. Supports `system`, `user`, `assistant`, `tool`, `developer`, and `function` roles. |

**Message Types:**

```typescript
// System message
{ role: 'system', content: 'You are helpful.' }

// User message (supports multimodal)
{
  role: 'user',
  content: 'Hello' // or array of content parts
}

// User message with image
{
  role: 'user',
  content: [
    { type: 'text', text: 'What is this?' },
    { type: 'image_url', image_url: { url: 'https://...', detail: 'auto' } }
  ]
}

// Assistant message
{ role: 'assistant', content: 'Hi there!' }

// Tool result message
{ role: 'tool', tool_call_id: 'call_123', content: '{"result": 42}' }
```

#### Generation Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `temperature` | `number` | Provider default | Sampling temperature (0-2). Higher = more random. |
| `top_p` | `number` | Provider default | Nucleus sampling threshold. |
| `top_k` | `number` | Provider default | Top-k sampling parameter. |
| `max_tokens` | `number` | Provider default | Maximum tokens in completion. |
| `max_completion_tokens` | `number` | - | Newer parameter name for max tokens. |
| `n` | `number` | 1 | Number of completions to generate. |
| `stop` | `string \| Array<string>` | - | Stop sequences. |
| `frequency_penalty` | `number` | 0 | Penalty for token frequency (-2.0 to 2.0). |
| `presence_penalty` | `number` | 0 | Penalty for token presence (-2.0 to 2.0). |
| `seed` | `number` | - | Random seed for deterministic output. |
| `logprobs` | `boolean` | false | Return log probabilities. |
| `top_logprobs` | `number` | - | Number of top logprobs to return (0-20). |

#### Streaming Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stream` | `boolean` | false | Enable streaming response via SSE. |
| `stream_options` | `object` | - | Additional streaming options. |

#### Tool/Function Calling Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tools` | `Array<ChatCompletionToolParam>` | Available tools/functions for the model. |
| `tool_choice` | `ToolChoice` | Controls tool usage: `'auto'`, `'none'`, `'required'`, or specific tool. |
| `parallel_tool_calls` | `boolean` | Enable parallel tool execution. |
| `automatic_tool_execution` | `boolean` | Execute tools server-side. If false, returns raw tool calls. |

**Tool Definition:**

```typescript
{
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name' }
          },
          required: ['location']
        },
        strict: true // Enable strict schema adherence
      }
    }
  ]
}
```

**Tool Choice Options:**

```typescript
// Auto - model decides
tool_choice: { type: 'auto' }

// Force any tool
tool_choice: { type: 'any' }

// Force specific tool
tool_choice: { type: 'tool', name: 'get_weather' }

// Disable tools
tool_choice: { type: 'none' }
```

#### Response Format Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `response_format` | `ResponseFormat` | Output format: `text`, `json_object`, or `json_schema`. |

**JSON Schema Response:**

```typescript
{
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
}
```

#### MCP & Routing Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `mcp_servers` | `string \| Array<string>` | MCP server identifiers (URLs, slugs, or IDs). |
| `model_attributes` | `object` | Model attributes for routing. Maps model IDs to attribute scores. |
| `handoff_config` | `object` | Configuration for multi-model handoffs. |
| `agent_attributes` | `object` | Agent attributes with values in [0.0, 1.0]. |

#### Provider-Specific Parameters

| Parameter | Provider | Description |
|-----------|----------|-------------|
| `thinking` | Anthropic | Extended thinking configuration. |
| `reasoning_effort` | OpenAI | Reasoning effort for o-series models. |
| `generation_config` | Google | Google-specific generation parameters. |
| `safety_settings` | Google | Content filtering settings. |
| `safe_prompt` | Mistral | Inject safety prompt. |

**Anthropic Extended Thinking:**

```typescript
{
  thinking: {
    type: 'enabled',
    budget_tokens: 4096 // Must be >= 1024 and < max_tokens
  }
}
```

#### Other Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `metadata` | `object` | Key-value pairs attached to the request. |
| `store` | `boolean` | Store output for fine-tuning. |
| `service_tier` | `string` | Processing tier: `'auto'`, `'default'`, `'flex'`, `'priority'`. |
| `user` | `string` | End-user identifier for abuse detection. |
| `deferred` | `boolean` | Return request_id for async retrieval. |
| `max_turns` | `number` | Maximum conversation turns. |
| `prediction` | `PredictionContent` | Predicted output for faster generation. |
| `web_search_options` | `object` | Web search tool configuration. |

### Response Object

#### Non-Streaming Response (`Completion`)

```typescript
interface Completion {
  id: string;                    // Unique completion ID
  object: 'chat.completion';     // Object type
  created: number;               // Unix timestamp
  model: string;                 // Model used
  choices: Array<Choice>;        // Completion choices
  usage?: CompletionUsage;       // Token usage stats
  system_fingerprint?: string;   // Backend configuration fingerprint
  service_tier?: string;         // Processing tier used
  tools_executed?: Array<string>; // Server-executed tools (MCP)
  mcp_server_errors?: object;    // MCP failure details
}

interface Choice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' | null;
  logprobs?: ChoiceLogprobs | null;
}

interface ChatCompletionMessage {
  role: 'assistant';
  content: string | null;
  refusal: string | null;
  tool_calls?: Array<ChatCompletionMessageToolCall>;
  function_call?: FunctionCall;  // Deprecated
  audio?: ChatCompletionAudio;
  annotations?: Array<Annotation>;
}

interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: PromptTokensDetails;
  completion_tokens_details?: CompletionTokensDetails;
}
```

#### Streaming Response (`StreamChunk`)

```typescript
interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<ChunkChoice>;
  usage?: CompletionUsage | null;  // Only in final chunk
  service_tier?: string | null;
  system_fingerprint?: string | null;
}

interface ChunkChoice {
  index: number;
  delta: ChoiceDelta;
  finish_reason: string | null;   // Only in final chunk
  logprobs?: ChoiceLogprobs | null;
}

interface ChoiceDelta {
  role?: 'assistant' | null;
  content?: string | null;
  tool_calls?: Array<ChoiceDeltaToolCall> | null;
  refusal?: string | null;
}
```

### HTTP Responses

| Status | Description |
|--------|-------------|
| 200 | Success - returns completion object |
| 400 | Bad Request - validation error |
| 401 | Unauthorized - authentication failed |
| 402 | Payment Required - quota/balance issue |
| 429 | Too Many Requests - rate limit exceeded |
| 500 | Internal Server Error |

---

## 2. Embeddings API

### `client.embeddings.create()`

Generate vector embeddings for text input.

### Basic Usage

```typescript
const response = await client.embeddings.create({
  model: 'text-embedding-3-small',
  input: 'Hello, world!'
});

console.log(response.data[0].embedding); // Float array
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `string \| Array<string> \| Array<number> \| Array<Array<number>>` | Yes | Text to embed. Can be string, array of strings, or tokenized input. |
| `model` | `string` | Yes | Model ID. Common values: `'text-embedding-ada-002'`, `'text-embedding-3-small'`, `'text-embedding-3-large'`. |
| `dimensions` | `number` | No | Output dimensions (only for `text-embedding-3` models). |
| `encoding_format` | `'float' \| 'base64'` | No | Output format. Default: `'float'`. |
| `user` | `string` | No | End-user identifier. |

### Constraints

- Maximum **8,192 tokens** per input
- Maximum **2,048 items** in input array
- Maximum **300,000 tokens** summed across all inputs in a single request

### Response Object

```typescript
interface CreateEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    embedding: Array<number> | string;  // Float array or base64
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
```

### Example with Multiple Inputs

```typescript
const response = await client.embeddings.create({
  model: 'text-embedding-3-large',
  input: ['First document', 'Second document', 'Third document'],
  dimensions: 1024  // Reduce dimensions for efficiency
});

// Access embeddings
response.data.forEach((item, i) => {
  console.log(`Document ${i}: ${item.embedding.length} dimensions`);
});
```

---

## 3. Models API

### `client.models.list()`

List all available models across providers.

### Basic Usage

```typescript
const models = await client.models.list();

models.data.forEach(model => {
  console.log(`${model.id} - ${model.provider}`);
});
```

### Response Object

```typescript
interface ListModelsResponse {
  object: 'list';
  data: Array<Model>;
}

interface Model {
  id: string;                    // e.g., 'openai/gpt-4'
  provider: 'openai' | 'anthropic' | 'google' | 'xai' | 'mistral' | 'groq' | 'fireworks' | 'deepseek';
  created_at: string;            // RFC 3339 timestamp
  display_name?: string;         // Human-readable name
  description?: string;          // Model description
  version?: string;              // Version identifier
  capabilities?: {
    text?: boolean;              // Text generation
    vision?: boolean;            // Image understanding
    audio?: boolean;             // Audio processing
    tools?: boolean;             // Function/tool calling
    streaming?: boolean;         // Streaming responses
    structured_output?: boolean; // JSON schema output
    thinking?: boolean;          // Extended reasoning
    image_generation?: boolean;  // Image generation
    input_token_limit?: number;  // Max input tokens
    output_token_limit?: number; // Max output tokens
  };
  defaults?: {
    temperature?: number;
    max_output_tokens?: number;
    top_p?: number;
    top_k?: number;
  };
  provider_info?: object;        // Raw provider metadata
  provider_declared_generation_methods?: Array<string>;
}
```

### `client.models.retrieve(modelId)`

Get detailed information about a specific model.

```typescript
const model = await client.models.retrieve('openai/gpt-4');

console.log(model.capabilities?.tools);  // true
console.log(model.capabilities?.vision); // true
```

### HTTP Responses

| Status | Description |
|--------|-------------|
| 200 | Success |
| 401 | Authentication failed |
| 404 | Model not found or not accessible |
| 500 | Internal error |

---

## 4. Error Handling

The SDK provides typed error classes for different failure scenarios.

### Error Hierarchy

```
DedalusError (base)
└── APIError
    ├── BadRequestError (400)
    ├── AuthenticationError (401)
    ├── PermissionDeniedError (403)
    ├── NotFoundError (404)
    ├── ConflictError (409)
    ├── UnprocessableEntityError (422)
    ├── RateLimitError (429)
    ├── InternalServerError (500+)
    ├── APIConnectionError
    │   └── APIConnectionTimeoutError
    └── APIUserAbortError
```

### Error Properties

```typescript
interface APIError {
  status: number | undefined;    // HTTP status code
  headers: Headers | undefined;  // Response headers
  error: object | undefined;     // JSON error body
  message: string;               // Error message
}
```

### Usage

```typescript
import Dedalus, {
  BadRequestError,
  AuthenticationError,
  RateLimitError,
  APIConnectionError
} from 'dedalus-labs';

try {
  const completion = await client.chat.completions.create({...});
} catch (error) {
  if (error instanceof BadRequestError) {
    console.error('Invalid request:', error.message);
    console.error('Details:', error.error);
  } else if (error instanceof AuthenticationError) {
    console.error('Check your API key');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.headers?.get('retry-after'));
  } else if (error instanceof APIConnectionError) {
    console.error('Network error:', error.cause);
  } else {
    throw error;
  }
}
```

### Automatic Retries

The SDK automatically retries these errors (2 times by default with exponential backoff):

- 408 Request Timeout
- 409 Conflict
- 429 Rate Limit
- 500+ Server Errors
- Connection Errors

Configure retries:

```typescript
const client = new Dedalus({
  maxRetries: 5,  // or 0 to disable
  timeout: 30000  // 30 seconds
});
```

---

## 5. MCP Server Integration

MCP (Model Context Protocol) servers extend model capabilities with external tools and data sources. The SDK passes MCP server identifiers to Dedalus's infrastructure, which handles the connection and tool execution.

### How It Works

1. You specify MCP servers in the request via `mcp_servers`
2. Dedalus connects to the MCP servers and discovers available tools
3. The model can invoke MCP tools during generation
4. **Tool execution happens server-side** on Dedalus's infrastructure
5. Results are incorporated into the response

### Usage

```typescript
const completion = await client.chat.completions.create({
  model: 'openai/gpt-4',
  messages: [{ role: 'user', content: 'Search for recent news about AI' }],
  mcp_servers: ['news-search-mcp', 'web-browser-mcp']
});

// Check which tools were executed server-side
if (completion.tools_executed) {
  console.log('MCP tools used:', completion.tools_executed);
}

// Check for MCP server errors
if (completion.mcp_server_errors) {
  console.log('MCP errors:', completion.mcp_server_errors);
}
```

### MCP Server Identifiers

The `mcp_servers` parameter accepts:

| Format | Example | Description |
|--------|---------|-------------|
| URL | `'https://mcp.example.com'` | Direct MCP server URL |
| Repository slug | `'owner/repo-name'` | GitHub repository with MCP server |
| Server ID | `'news-search-mcp'` | Registered server identifier |

### MCP vs Local Tools

| Aspect | MCP Tools | Local Tools |
|--------|-----------|-------------|
| Definition | Registered on MCP servers | Passed via `tools` parameter |
| Execution | Server-side (Dedalus) | Client-side (your code) |
| Discovery | Automatic from MCP server | Manual schema definition |
| Results | Automatically incorporated | Must be sent back as messages |

### DedalusRunner and MCP

When using `DedalusRunner`, MCP tools are distinguished from local tools:

```typescript
import { DedalusRunner } from 'dedalus-labs';

const runner = new DedalusRunner(client);
const result = await runner.run({
  model: 'openai/gpt-4',
  input: 'What is the weather in NYC?',
  tools: [localWeatherFunction],     // Executed client-side
  mcpServers: ['weather-mcp'],       // Executed server-side
  autoExecuteTools: true
});
```

The runner:
1. Sends both local tool schemas and MCP server IDs to the API
2. Receives tool calls in the response
3. Checks if each tool is local or MCP (by name matching)
4. Executes **only local tools** client-side
5. MCP tools are already executed server-side - results are in the streamed content

---

## 6. Model Routing & Handoff

Dedalus supports multi-model routing where the system can select or hand off between models based on task requirements.

### How Model Routing Works

**Important:** Model routing logic is **server-side** on Dedalus's infrastructure. The SDK's role is to pass the model configuration to the API.

### Model Parameter Formats

#### Single Model (String)

```typescript
{
  model: 'openai/gpt-4'
}
```

#### Single Model with Settings (DedalusModel)

```typescript
{
  model: {
    model: 'openai/gpt-4',
    settings: {
      temperature: 0.7,
      max_tokens: 1000
    }
  }
}
```

#### Multiple Models (Array for Routing)

```typescript
{
  model: [
    'openai/gpt-4',
    'anthropic/claude-3-5-sonnet',
    'google/gemini-1.5-pro'
  ]
}
```

#### Multiple Models with Individual Settings

```typescript
{
  model: [
    {
      model: 'openai/gpt-4',
      settings: { temperature: 0.7 }
    },
    {
      model: 'anthropic/claude-3-5-sonnet',
      settings: { temperature: 0.5 }
    }
  ]
}
```

### DedalusModel Settings

When using `DedalusModel` objects, you can specify per-model settings:

```typescript
interface DedalusModel {
  model: string;  // Model ID with provider prefix
  settings?: {
    temperature?: number;
    max_tokens?: number;
    max_completion_tokens?: number;
    top_p?: number;
    top_k?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | Array<string>;
    response_format?: object;
    tool_choice?: object;
    seed?: number;
    // ... and more provider-specific options
  };
}
```

### Model Attributes for Routing

Use `model_attributes` to provide scoring hints for routing:

```typescript
{
  model: ['openai/gpt-4', 'anthropic/claude-3-5-sonnet'],
  model_attributes: {
    'openai/gpt-4': {
      'coding': 0.9,
      'creativity': 0.7,
      'speed': 0.5
    },
    'anthropic/claude-3-5-sonnet': {
      'coding': 0.85,
      'creativity': 0.95,
      'speed': 0.8
    }
  }
}
```

Values are floats in `[0.0, 1.0]` representing capability scores.

### Agent Attributes

Use `agent_attributes` to describe the current task:

```typescript
{
  model: ['openai/gpt-4', 'anthropic/claude-3-5-sonnet'],
  agent_attributes: {
    'coding': 0.2,
    'creativity': 0.9
  }
}
```

The server uses these attributes combined with `model_attributes` to select the best model.

### Handoff Configuration

Use `handoff_config` for advanced multi-model orchestration:

```typescript
{
  model: ['openai/gpt-4', 'anthropic/claude-3-5-sonnet'],
  handoff_config: {
    // Server-side configuration (structure depends on Dedalus API)
  }
}
```

### What Happens Server-Side

When you pass multiple models:

1. **SDK sends the full array** to `/v1/chat/completions`
2. **Dedalus server** receives the model list + optional routing hints
3. **Server selects** the initial model based on:
   - Model attributes vs agent attributes matching
   - Handoff configuration rules
   - Provider availability and load
4. **During conversation**, the server may hand off to another model if:
   - The current model signals it can't handle the task
   - Routing rules determine another model is better suited
   - Rate limits or errors occur on the current model

### Response Model Information

The response indicates which model was actually used:

```typescript
const completion = await client.chat.completions.create({
  model: ['openai/gpt-4', 'anthropic/claude-3-5-sonnet'],
  messages: [...]
});

console.log(completion.model);  // e.g., 'openai/gpt-4' - the model that responded
```

### SDK Runner Tracking

When using `DedalusRunner`, you can track which models were used:

```typescript
const result = await runner.run({
  model: ['openai/gpt-4', 'anthropic/claude-3-5-sonnet'],
  input: 'Complex task...',
  maxSteps: 5
});

console.log(result.modelsUsed);  // Array of models used across steps
```

Note: The runner tracks `modelsUsed` locally based on the response's `model` field, but multi-step handoffs are coordinated server-side.

---

## Summary

| Feature | SDK Role | Server Role |
|---------|----------|-------------|
| Chat Completions | Send request, receive response | Model inference, tool routing |
| Embeddings | Send text, receive vectors | Vector generation |
| Models | List/retrieve metadata | Serve model catalog |
| MCP Integration | Pass server IDs | Connect, discover tools, execute |
| Model Routing | Pass model array + attributes | Select and hand off between models |
| Error Handling | Typed errors, auto-retry | Return appropriate HTTP codes |

The SDK is primarily a transport layer that structures requests and handles responses. The intelligent features (model selection, MCP tool execution, routing) happen on Dedalus's infrastructure.
