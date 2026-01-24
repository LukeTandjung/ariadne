import { describe, expect, test } from "bun:test";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { LanguageModel, IdGenerator, Tool, Toolkit } from "@src/ariadne";
import * as DedalusClient from "../../src/DedalusClient.js";
import * as DedalusLanguageModel from "../../src/DedalusLanguageModel.js";
import * as Generated from "../../src/Generated.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const mockChatCompletion: typeof Generated.ChatCompletion.Encoded = {
  id: "chatcmpl-123",
  object: "chat.completion",
  created: 1677652288,
  model: "openai/gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "Hello! How can I help you today?",
        refusal: null,
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 15,
    total_tokens: 25,
  },
};

const mockChatCompletionWithToolCall: typeof Generated.ChatCompletion.Encoded =
  {
    id: "chatcmpl-456",
    object: "chat.completion",
    created: 1677652288,
    model: "openai/gpt-4o",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: "call_abc123",
              type: "function",
              function: {
                name: "get_weather",
                arguments: '{"location":"San Francisco","units":"celsius"}',
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 30,
      total_tokens: 50,
    },
  };

const mockChatCompletionWithCustomToolCall: typeof Generated.ChatCompletion.Encoded =
  {
    id: "chatcmpl-789",
    object: "chat.completion",
    created: 1677652288,
    model: "openai/gpt-4o",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          refusal: null,
          tool_calls: [
            {
              id: "call_custom_123",
              type: "custom",
              custom: {
                name: "mcp_brave_search",
                input: '{"query":"Effect TypeScript"}',
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: {
      prompt_tokens: 15,
      completion_tokens: 25,
      total_tokens: 40,
    },
  };

// =============================================================================
// Test Tools
// =============================================================================

const GetWeatherTool = Tool.make("get_weather", {
  description: "Get the weather for a location",
  parameters: {
    location: Schema.String,
    units: Schema.String,
  },
  success: Schema.String,
});

const McpBraveSearchTool = Tool.make("mcp_brave_search", {
  description: "Search the web using Brave",
  parameters: {
    query: Schema.String,
  },
  success: Schema.String,
});

const WeatherToolkit = Toolkit.make(GetWeatherTool);
const BraveSearchToolkit = Toolkit.make(McpBraveSearchTool);

// =============================================================================
// Mock HTTP Client
// =============================================================================

const createMockHttpClient = (
  mockResponse: unknown,
): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    ),
  );

// =============================================================================
// Tests
// =============================================================================

describe("DedalusLanguageModel", () => {
  describe("generateText", () => {
    test("should generate text from a simple prompt", async () => {
      const program = LanguageModel.generateText({
        prompt: "Hello, world!",
      });

      const result = await program.pipe(
        Effect.provide(DedalusLanguageModel.layer({ model: "openai/gpt-4o" })),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockChatCompletion)),
        Effect.provide(
          Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
        ),
        Effect.runPromise,
      );

      expect(result.text).toBe("Hello! How can I help you today?");
      expect(result.finishReason).toBe("stop");
      expect(result.usage.inputTokens).toBe(10);
      expect(result.usage.outputTokens).toBe(15);
    });

    test("should handle function tool calls", async () => {
      const program = LanguageModel.generateText({
        prompt: "What's the weather?",
        toolkit: WeatherToolkit,
        disableToolCallResolution: true,
      });

      const result = await program.pipe(
        Effect.provide(DedalusLanguageModel.layer({ model: "openai/gpt-4o" })),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockChatCompletionWithToolCall)),
        Effect.provide(
          Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
        ),
        Effect.runPromise,
      );

      expect(result.finishReason).toBe("tool-calls");
      expect(result.toolCalls).toContainEqual(
        expect.objectContaining({
          type: "tool-call",
          id: "call_abc123",
          name: "get_weather",
          params: { location: "San Francisco", units: "celsius" },
        }),
      );
    });

    test("should handle custom tool calls (MCP tools)", async () => {
      const program = LanguageModel.generateText({
        prompt: "Search for Effect TypeScript",
        toolkit: BraveSearchToolkit,
        disableToolCallResolution: true,
      });

      const result = await program.pipe(
        Effect.provide(DedalusLanguageModel.layer({ model: "openai/gpt-4o" })),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(
          createMockHttpClient(mockChatCompletionWithCustomToolCall),
        ),
        Effect.provide(
          Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
        ),
        Effect.runPromise,
      );

      expect(result.finishReason).toBe("tool-calls");
      expect(result.toolCalls).toContainEqual(
        expect.objectContaining({
          type: "tool-call",
          id: "call_custom_123",
          name: "mcp_brave_search",
          params: { query: "Effect TypeScript" },
        }),
      );
    });
  });

  describe("finish reasons", () => {
    test.each([
      ["stop", "stop"],
      ["length", "length"],
      ["content_filter", "content-filter"],
      ["tool_calls", "tool-calls"],
      ["function_call", "tool-calls"],
    ] as const)(
      "should map finish_reason '%s' to '%s'",
      async (apiReason, expectedReason) => {
        const mockResponse = {
          ...mockChatCompletion,
          choices: [
            {
              ...mockChatCompletion.choices[0],
              finish_reason: apiReason,
            },
          ],
        };

        const program = LanguageModel.generateText({
          prompt: "Test",
        });

        const result = await program.pipe(
          Effect.provide(DedalusLanguageModel.layer({ model: "openai/gpt-4o" })),
          Effect.provide(DedalusClient.layer({})),
          Effect.provide(createMockHttpClient(mockResponse)),
          Effect.provide(
            Layer.succeed(
              IdGenerator.IdGenerator,
              IdGenerator.defaultIdGenerator,
            ),
          ),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe(expectedReason);
      },
    );
  });

  describe("error handling", () => {
    test("should handle validation errors", async () => {
      const mockErrorClient = Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  detail: [
                    {
                      loc: ["body", "model"],
                      msg: "field required",
                      type: "missing",
                    },
                  ],
                }),
                {
                  status: 422,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            ),
          ),
        ),
      );

      const program = LanguageModel.generateText({
        prompt: "Test",
      });

      const result = await program.pipe(
        Effect.provide(DedalusLanguageModel.layer({ model: "openai/gpt-4o" })),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(mockErrorClient),
        Effect.provide(
          Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
        ),
        Effect.flip,
        Effect.runPromise,
      );

      expect(result._tag).toBe("MalformedInput");
    });
  });
});
