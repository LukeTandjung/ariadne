import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as AgentRunner from "../src/AgentRunner.js";
import * as LanguageModel from "../src/LanguageModel.js";
import * as Prompt from "../src/Prompt.js";
import * as Response from "../src/Response.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const createTextPart = (text: string): Response.TextPart =>
  Response.makePart("text", { text });

const createToolCallPart = (
  id: string,
  name: string,
  params: Record<string, unknown>,
): Response.ToolCallPart<any, any> =>
  Response.makePart("tool-call", {
    id,
    name,
    params,
    providerExecuted: false,
  });

const createToolResultPart = (
  id: string,
  name: string,
  params: Record<string, unknown>,
  result: unknown,
): Response.ToolResultPart<any, any, any> =>
  Response.makePart("tool-result", {
    id,
    name,
    params,
    result,
    providerExecuted: false,
  });

const createFinishPart = (reason: Response.FinishReason): Response.FinishPart =>
  Response.makePart("finish", {
    reason,
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
  });

// =============================================================================
// Mock LanguageModel
// =============================================================================

/**
 * Creates a mock LanguageModel that returns responses in sequence.
 * Used to simulate multi-turn conversations.
 */
const createMockLanguageModel = (
  responses: Array<{
    content: Array<Response.AnyPart>;
    finishReason: Response.FinishReason;
  }>,
): Layer.Layer<LanguageModel.LanguageModel> => {
  let callIndex = 0;

  return Layer.succeed(LanguageModel.LanguageModel, {
    generateText: Effect.fnUntraced(function* (_options) {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return new LanguageModel.GenerateTextResponse(response.content);
    }),
    generateObject: Effect.fnUntraced(function* (_options) {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      const objectPart = response.content.find(
        (p) => p.type === "object-done",
      ) as Response.ObjectDonePart | undefined;
      return new LanguageModel.GenerateObjectResponse(
        objectPart?.value,
        response.content,
      );
    }),
    streamText: Effect.fnUntraced(function* (_options) {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return Stream.fromIterable(
        response.content as Array<Response.AnyStreamPart>,
      );
    }, Stream.unwrap),
    streamObject: (_options) => {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return Stream.fromIterable(
        response.content as Array<Response.ObjectStreamPart>,
      );
    },
  });
};

// =============================================================================
// Tests: generateText
// =============================================================================

describe("AgentRunner", () => {
  describe("ReAct layer", () => {
    describe("generateText", () => {
      test("should terminate on stop finish reason", async () => {
        const mockResponses = [
          {
            content: [
              createTextPart("Hello!"),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "Hello",
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(result.text).toBe("Hello!");
        expect(result.finishReason).toBe("stop");
      });

      test("should continue loop on tool-calls and terminate on stop", async () => {
        const mockResponses = [
          // First turn: model calls a tool
          {
            content: [
              createToolCallPart("call_1", "calculator", {
                operation: "add",
                a: 1,
                b: 2,
              }),
              createToolResultPart(
                "call_1",
                "calculator",
                { operation: "add", a: 1, b: 2 },
                3,
              ),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
          // Second turn: model returns final answer
          {
            content: [
              createTextPart("The result is 3."),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "What is 1 + 2?",
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        // Should accumulate content from both turns
        // Turn 1: toolCall, toolResult (finish excluded from intermediate)
        // Turn 2: text, finish
        expect(result.text).toBe("The result is 3.");
        expect(result.finishReason).toBe("stop");
        expect(result.content.length).toBe(4);
      });

      test("should accumulate content from multiple turns", async () => {
        const mockResponses = [
          // Turn 1: tool call
          {
            content: [
              createToolCallPart("call_1", "search", { query: "weather" }),
              createToolResultPart(
                "call_1",
                "search",
                { query: "weather" },
                "Sunny, 72°F",
              ),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
          // Turn 2: another tool call
          {
            content: [
              createToolCallPart("call_2", "search", { query: "news" }),
              createToolResultPart(
                "call_2",
                "search",
                { query: "news" },
                "Headlines...",
              ),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
          // Turn 3: final response
          {
            content: [
              createTextPart("Weather is sunny and here are the news."),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "Get weather and news",
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        // Should have all tool calls and results from all turns
        expect(result.toolCalls.length).toBe(2);
        expect(result.toolResults.length).toBe(2);
        expect(result.text).toBe("Weather is sunny and here are the news.");
      });

      test("should terminate on length finish reason", async () => {
        const mockResponses = [
          {
            content: [
              createTextPart("Truncated response..."),
              createFinishPart("length"),
            ],
            finishReason: "length" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "Tell me a long story",
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("length");
      });

      test("should terminate on content-filter finish reason", async () => {
        const mockResponses = [
          {
            content: [createFinishPart("content-filter")],
            finishReason: "content-filter" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "Test prompt",
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("content-filter");
      });

      test("should respect maxTurns configuration", async () => {
        // Create responses that always return tool-calls (infinite loop scenario)
        const mockResponses = [
          {
            content: [
              createToolCallPart("call_1", "tool", {}),
              createToolResultPart("call_1", "tool", {}, "result"),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
        ];

        const program = LanguageModel.generateText({
          prompt: "Loop forever",
        });

        const customConfig = Layer.succeed(AgentRunner.Config, {
          maxTurns: 3,
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(customConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        // Should have content from exactly 3 turns (3 tool calls, 3 tool results, 3 finish parts)
        expect(result.toolCalls.length).toBe(3);
        expect(result.toolResults.length).toBe(3);
      });

      test("should use default maxTurns of 10 when not configured", async () => {
        let callCount = 0;
        const mockLayer = Layer.succeed(LanguageModel.LanguageModel, {
          generateText: Effect.fnUntraced(function* (_options) {
            callCount++;
            return new LanguageModel.GenerateTextResponse([
              createToolCallPart(`call_${callCount}`, "tool", {}),
              createToolResultPart(`call_${callCount}`, "tool", {}, "result"),
              createFinishPart("tool-calls"),
            ]);
          }),
          generateObject: Effect.fnUntraced(function* (_options) {
            return new LanguageModel.GenerateObjectResponse(undefined, []);
          }),
          streamText: Effect.fnUntraced(function* (_options) {
            return Stream.empty;
          }, Stream.unwrap),
          streamObject: (_options) => Stream.empty,
        });

        const program = LanguageModel.generateText({
          prompt: "Loop",
        });

        await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(mockLayer),
          Effect.runPromise,
        );

        expect(callCount).toBe(10);
      });
    });

    // =============================================================================
    // Tests: generateObject
    // =============================================================================

    describe("generateObject", () => {
      test("should terminate on stop finish reason", async () => {
        const mockResponses = [
          {
            content: [
              Response.makePart("object-done", {
                id: "obj_1",
                value: { name: "Alice", age: 30 },
                raw: '{"name":"Alice","age":30}',
              }),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const PersonSchema = Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
        });

        const program = LanguageModel.generateObject({
          prompt: "Create a person",
          schema: PersonSchema,
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(result.value).toEqual({ name: "Alice", age: 30 });
        expect(result.finishReason).toBe("stop");
      });

      test("should continue loop with tool calls during object generation", async () => {
        const mockResponses = [
          // Turn 1: tool call to gather data
          {
            content: [
              createToolCallPart("call_1", "fetch_data", {}),
              createToolResultPart("call_1", "fetch_data", {}, { data: "value" }),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
          // Turn 2: final object
          {
            content: [
              Response.makePart("object-done", {
                id: "obj_1",
                value: { result: "computed" },
                raw: '{"result":"computed"}',
              }),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const ResultSchema = Schema.Struct({
          result: Schema.String,
        });

        const program = LanguageModel.generateObject({
          prompt: "Compute result",
          schema: ResultSchema,
        });

        const result = await program.pipe(
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(result.value).toEqual({ result: "computed" });
        expect(result.toolCalls.length).toBe(1);
        expect(result.toolResults.length).toBe(1);
      });
    });

    // =============================================================================
    // Tests: streamText
    // =============================================================================

    describe("streamText", () => {
      test("should stream and terminate on stop", async () => {
        const mockResponses = [
          {
            content: [
              Response.makePart("text-delta", { delta: "Hello " }),
              Response.makePart("text-delta", { delta: "World!" }),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const parts: Array<Response.AnyStreamPart> = [];

        const stream = LanguageModel.streamText({
          prompt: "Say hello",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              parts.push(part);
            }),
          ),
          Stream.runDrain,
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        expect(parts.filter((p) => p.type === "text-delta").length).toBe(2);
        expect(parts.some((p) => p.type === "finish")).toBe(true);
      });

      test("should continue streaming across multiple turns", async () => {
        const mockResponses = [
          // Turn 1: tool call
          {
            content: [
              createToolCallPart("call_1", "tool", {}),
              createToolResultPart("call_1", "tool", {}, "result"),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
          // Turn 2: final text
          {
            content: [
              Response.makePart("text-delta", { delta: "Final answer." }),
              createFinishPart("stop"),
            ],
            finishReason: "stop" as const,
          },
        ];

        const parts: Array<Response.AnyStreamPart> = [];

        const stream = LanguageModel.streamText({
          prompt: "Do something",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              parts.push(part);
            }),
          ),
          Stream.runDrain,
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        // Should have parts from both turns
        expect(parts.some((p) => p.type === "tool-call")).toBe(true);
        expect(parts.some((p) => p.type === "tool-result")).toBe(true);
        expect(parts.some((p) => p.type === "text-delta")).toBe(true);
        // Should have two finish parts (one per turn)
        expect(parts.filter((p) => p.type === "finish").length).toBe(2);
      });

      test("should respect maxTurns in streaming", async () => {
        const mockResponses = [
          {
            content: [
              createToolCallPart("call_1", "tool", {}),
              createToolResultPart("call_1", "tool", {}, "result"),
              createFinishPart("tool-calls"),
            ],
            finishReason: "tool-calls" as const,
          },
        ];

        const parts: Array<Response.AnyStreamPart> = [];
        const customConfig = Layer.succeed(AgentRunner.Config, { maxTurns: 2 });

        const stream = LanguageModel.streamText({
          prompt: "Loop",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              parts.push(part);
            }),
          ),
          Stream.runDrain,
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(customConfig),
          Effect.provide(createMockLanguageModel(mockResponses)),
          Effect.runPromise,
        );

        // Should have exactly 2 finish parts (maxTurns = 2)
        expect(parts.filter((p) => p.type === "finish").length).toBe(2);
      });
    });

    // =============================================================================
    // Tests: Config
    // =============================================================================

    describe("Config", () => {
      test("getOrUndefined should return undefined when not provided", async () => {
        const result = await AgentRunner.Config.getOrUndefined.pipe(
          Effect.runPromise,
        );

        expect(result).toBeUndefined();
      });

      test("getOrUndefined should return config when provided", async () => {
        const result = await AgentRunner.Config.getOrUndefined.pipe(
          Effect.provide(Layer.succeed(AgentRunner.Config, { maxTurns: 5 })),
          Effect.runPromise,
        );

        expect(result).toEqual({ maxTurns: 5 });
      });
    });

    // =============================================================================
    // Tests: Without AgentRunner (baseline)
    // =============================================================================

    describe("without AgentRunner (baseline)", () => {
      test("should not loop without ReAct layer", async () => {
        let callCount = 0;
        const mockLayer = Layer.succeed(LanguageModel.LanguageModel, {
          generateText: Effect.fnUntraced(function* (_options) {
            callCount++;
            return new LanguageModel.GenerateTextResponse([
              createToolCallPart("call_1", "tool", {}),
              createToolResultPart("call_1", "tool", {}, "result"),
              createFinishPart("tool-calls"),
            ]);
          }),
          generateObject: Effect.fnUntraced(function* (_options) {
            return new LanguageModel.GenerateObjectResponse(undefined, []);
          }),
          streamText: Effect.fnUntraced(function* (_options) {
            return Stream.empty;
          }, Stream.unwrap),
          streamObject: (_options) => Stream.empty,
        });

        const program = LanguageModel.generateText({
          prompt: "Test",
        });

        const result = await program.pipe(
          Effect.provide(mockLayer),
          Effect.runPromise,
        );

        // Without ReAct, should only call once
        expect(callCount).toBe(1);
        expect(result.finishReason).toBe("tool-calls");
      });
    });
  });
});
