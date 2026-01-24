import { describe, expect, test } from "bun:test";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import * as Schema from "effect/Schema";
import {
  AgentRunner,
  LanguageModel,
  EmbeddingModel,
  IdGenerator,
  Tool,
  Toolkit,
  McpRegistry,
} from "@src/ariadne";
import * as DedalusClient from "../../src/DedalusClient.js";
import * as DedalusEmbeddingModel from "../../src/DedalusEmbeddingModel.js";
import * as DedalusLanguageModel from "../../src/DedalusLanguageModel.js";

// =============================================================================
// Setup
// =============================================================================

const apiKey = process.env.DEDALUS_API_KEY;
const skipIfNoApiKey = apiKey ? test : test.skip;

// Client layer (with HttpClient)
const Dedalus = DedalusClient.layer({
  apiKey: apiKey ? Redacted.make(apiKey) : undefined,
}).pipe(Layer.provide(FetchHttpClient.layer));

// Models
const Gpt4oMini = DedalusLanguageModel.model("openai/gpt-4o-mini");
const ClaudeSonnet = DedalusLanguageModel.model("anthropic/claude-sonnet-4-20250514");
const MultiModel = DedalusLanguageModel.model([
  "openai/gpt-4o-mini",
  "anthropic/claude-sonnet-4-20250514",
]);
const TextEmbeddingBatched = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "batched" },
);
const TextEmbeddingDataLoader = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "data-loader", window: "100 millis" },
);

// =============================================================================
// Test Tools
// =============================================================================

const CalculatorTool = Tool.make("calculator", {
  description: "Perform basic arithmetic calculations",
  parameters: {
    operation: Schema.Literal("add", "subtract", "multiply", "divide"),
    a: Schema.Number,
    b: Schema.Number,
  },
  success: Schema.Number,
});

const CalculatorToolkit = Toolkit.make(CalculatorTool);

const CalculatorToolkitLive = CalculatorToolkit.toLayer({
  calculator: ({ operation, a, b }) =>
    Effect.succeed(
      operation === "add"
        ? a + b
        : operation === "subtract"
          ? a - b
          : operation === "multiply"
            ? a * b
            : a / b,
    ),
});

// =============================================================================
// Integration Tests
// =============================================================================

describe("Integration Tests", () => {
  describe("generateText", () => {
    skipIfNoApiKey(
      "should generate text from a simple prompt",
      async () => {
        const program = LanguageModel.generateText({
          prompt: "What is 2 + 2? Reply with just the number.",
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.text).toContain("4");
        expect(result.finishReason).toBe("stop");
        expect(result.usage.inputTokens).toBeGreaterThan(0);
        expect(result.usage.outputTokens).toBeGreaterThan(0);
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should handle system messages",
      async () => {
        const program = LanguageModel.generateText({
          system: "You are a pirate. Always respond in pirate speak.",
          prompt: "Say hello",
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.text.length).toBeGreaterThan(0);
        expect(result.finishReason).toBe("stop");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should execute tool calls and return results",
      async () => {
        const program = LanguageModel.generateText({
          prompt: "What is 15 multiplied by 7? Use the calculator tool.",
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("tool-calls");
        expect(result.toolCalls.length).toBeGreaterThan(0);
        expect(result.toolCalls[0].name).toBe("calculator");
        expect(result.toolCalls[0].params.operation).toBe("multiply");

        expect(result.toolResults.length).toBeGreaterThan(0);
        expect(result.toolResults[0].result).toBe(105);
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should work with multi-model routing",
      async () => {
        const program = LanguageModel.generateText({
          prompt: "Say 'hello' in one word.",
        });

        const result = await program.pipe(
          Effect.provide(MultiModel),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.text.toLowerCase()).toContain("hello");
        expect(result.finishReason).toBe("stop");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should work with MCP servers",
      async () => {
        const program = LanguageModel.generateText({
          prompt: "Search for TypeScript 5.7 features and list one.",
          mcpServers: [McpRegistry.marketplace("tsion/exa")],
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("stop");
        expect(result.text.length).toBeGreaterThan(0);
      },
      { timeout: 60000 },
    );
  });

  describe("streamText", () => {
    skipIfNoApiKey(
      "should stream text responses",
      async () => {
        const parts: Array<{ type: string }> = [];
        let fullText = "";

        const stream = LanguageModel.streamText({
          prompt: "Count from 1 to 5, one number per line.",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              parts.push({ type: part.type });
              if (part.type === "text-delta") {
                fullText += part.delta;
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(parts.some((p) => p.type === "response-metadata")).toBe(true);
        expect(parts.some((p) => p.type === "text-delta")).toBe(true);
        expect(parts.some((p) => p.type === "finish")).toBe(true);
        expect(fullText).toContain("1");
        expect(fullText).toContain("5");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should stream tool calls and results",
      async () => {
        const parts: Array<{ type: string; name?: string; result?: unknown }> =
          [];

        const stream = LanguageModel.streamText({
          prompt: "Add 10 and 20 using the calculator.",
          toolkit: CalculatorToolkit,
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              if (part.type === "tool-call") {
                parts.push({ type: part.type, name: part.name });
              } else if (part.type === "tool-result") {
                parts.push({
                  type: part.type,
                  name: part.name,
                  result: part.result,
                });
              } else {
                parts.push({ type: part.type });
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(parts.some((p) => p.type === "tool-call")).toBe(true);
        expect(parts.some((p) => p.type === "tool-result")).toBe(true);

        const toolResultPart = parts.find((p) => p.type === "tool-result");
        expect(toolResultPart?.name).toBe("calculator");
        expect(toolResultPart?.result).toBe(30);
      },
      { timeout: 60000 },
    );
  });

  describe("embeddings (batched mode)", () => {
    skipIfNoApiKey(
      "should embed a single text",
      async () => {
        const program = Effect.gen(function* () {
          const model = yield* EmbeddingModel.EmbeddingModel;
          return yield* model.embed("Hello, world!");
        });

        const result = await program.pipe(
          Effect.provide(TextEmbeddingBatched),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(typeof result[0]).toBe("number");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should embed multiple texts",
      async () => {
        const program = Effect.gen(function* () {
          const model = yield* EmbeddingModel.EmbeddingModel;
          return yield* model.embedMany([
            "The quick brown fox",
            "jumps over the lazy dog",
          ]);
        });

        const result = await program.pipe(
          Effect.provide(TextEmbeddingBatched),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result[0].length).toBeGreaterThan(0);
        expect(result[1].length).toBeGreaterThan(0);
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should batch concurrent embed calls into single API request",
      async () => {
        const program = Effect.gen(function* () {
          const model = yield* EmbeddingModel.EmbeddingModel;
          // Make 3 concurrent embed calls - should be batched
          const results = yield* Effect.all([
            model.embed("First text"),
            model.embed("Second text"),
            model.embed("Third text"),
          ]);
          return results;
        });

        const results = await program.pipe(
          Effect.provide(TextEmbeddingBatched),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(results.length).toBe(3);
        results.forEach((embedding) => {
          expect(Array.isArray(embedding)).toBe(true);
          expect(embedding.length).toBeGreaterThan(0);
        });
      },
      { timeout: 30000 },
    );
  });

  describe("embeddings (data-loader mode)", () => {
    skipIfNoApiKey(
      "should embed using data-loader with time window",
      async () => {
        const program = Effect.gen(function* () {
          const model = yield* EmbeddingModel.EmbeddingModel;
          return yield* model.embed("Hello from data-loader!");
        });

        const result = await program.pipe(
          Effect.scoped,
          Effect.provide(TextEmbeddingDataLoader),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(typeof result[0]).toBe("number");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should batch requests within time window",
      async () => {
        const program = Effect.gen(function* () {
          const model = yield* EmbeddingModel.EmbeddingModel;
          // Make concurrent calls - should be batched within the 100ms window
          const results = yield* Effect.all([
            model.embed("Window test 1"),
            model.embed("Window test 2"),
          ]);
          return results;
        });

        const results = await program.pipe(
          Effect.scoped,
          Effect.provide(TextEmbeddingDataLoader),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(results.length).toBe(2);
        results.forEach((embedding) => {
          expect(Array.isArray(embedding)).toBe(true);
          expect(embedding.length).toBeGreaterThan(0);
        });
      },
      { timeout: 30000 },
    );
  });

  describe("mixing models", () => {
    skipIfNoApiKey(
      "should allow providing different models to different calls",
      async () => {
        const generateJoke = LanguageModel.generateText({
          prompt: "Tell me a one-liner joke",
        });

        // Use GPT for one call, Claude for another
        const program = Effect.gen(function* () {
          const gptJoke = yield* Effect.provide(generateJoke, Gpt4oMini);
          const claudeJoke = yield* Effect.provide(generateJoke, ClaudeSonnet);
          return { gptJoke: gptJoke.text, claudeJoke: claudeJoke.text };
        });

        const result = await program.pipe(
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.gptJoke.length).toBeGreaterThan(0);
        expect(result.claudeJoke.length).toBeGreaterThan(0);
      },
      { timeout: 60000 },
    );
  });

  describe("structured outputs (generateObject)", () => {
    // Schema for a person
    const PersonSchema = Schema.Struct({
      name: Schema.String,
      age: Schema.Number,
      occupation: Schema.String,
    });

    // Schema for a recipe
    const RecipeSchema = Schema.Struct({
      title: Schema.String,
      ingredients: Schema.Array(Schema.String),
      steps: Schema.Array(Schema.String),
      prepTimeMinutes: Schema.Number,
    });

    // Schema for sentiment analysis
    const SentimentSchema = Schema.Struct({
      sentiment: Schema.Literal("positive", "negative", "neutral"),
      confidence: Schema.Number,
      reasoning: Schema.String,
    });

    skipIfNoApiKey(
      "should generate a structured person object",
      async () => {
        const program = LanguageModel.generateObject({
          prompt:
            "Create a fictional person who is a software engineer in their 30s.",
          schema: PersonSchema,
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.value).toBeDefined();
        expect(typeof result.value.name).toBe("string");
        expect(typeof result.value.age).toBe("number");
        expect(typeof result.value.occupation).toBe("string");
        expect(result.value.name.length).toBeGreaterThan(0);
        expect(result.value.age).toBeGreaterThanOrEqual(30);
        expect(result.value.age).toBeLessThan(40);
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should generate a structured recipe with arrays",
      async () => {
        const program = LanguageModel.generateObject({
          prompt:
            "Create a simple recipe for scrambled eggs with at least 3 ingredients and 3 steps.",
          schema: RecipeSchema,
          objectName: "recipe",
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.value).toBeDefined();
        expect(typeof result.value.title).toBe("string");
        expect(Array.isArray(result.value.ingredients)).toBe(true);
        expect(Array.isArray(result.value.steps)).toBe(true);
        expect(result.value.ingredients.length).toBeGreaterThanOrEqual(3);
        expect(result.value.steps.length).toBeGreaterThanOrEqual(3);
        expect(typeof result.value.prepTimeMinutes).toBe("number");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should generate sentiment analysis with literals",
      async () => {
        const program = LanguageModel.generateObject({
          prompt:
            'Analyze the sentiment of this text: "I absolutely love this product! It exceeded all my expectations."',
          schema: SentimentSchema,
          objectName: "sentiment_analysis",
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.value).toBeDefined();
        expect(["positive", "negative", "neutral"]).toContain(
          result.value.sentiment,
        );
        expect(result.value.sentiment).toBe("positive");
        expect(typeof result.value.confidence).toBe("number");
        expect(result.value.confidence).toBeGreaterThan(0);
        expect(result.value.confidence).toBeLessThanOrEqual(1);
        expect(typeof result.value.reasoning).toBe("string");
      },
      { timeout: 30000 },
    );

    skipIfNoApiKey(
      "should work with nested schemas",
      async () => {
        const AddressSchema = Schema.Struct({
          street: Schema.String,
          city: Schema.String,
          country: Schema.String,
        });

        const CompanySchema = Schema.Struct({
          name: Schema.String,
          industry: Schema.String,
          headquarters: AddressSchema,
          employeeCount: Schema.Number,
        });

        const program = LanguageModel.generateObject({
          prompt:
            "Create a fictional tech company based in San Francisco with around 500 employees.",
          schema: CompanySchema,
          objectName: "company",
        });

        const result = await program.pipe(
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.value).toBeDefined();
        expect(typeof result.value.name).toBe("string");
        expect(typeof result.value.industry).toBe("string");
        expect(result.value.headquarters).toBeDefined();
        expect(typeof result.value.headquarters.street).toBe("string");
        expect(typeof result.value.headquarters.city).toBe("string");
        expect(result.value.headquarters.city.toLowerCase()).toContain(
          "san francisco",
        );
        expect(typeof result.value.headquarters.country).toBe("string");
        expect(typeof result.value.employeeCount).toBe("number");
      },
      { timeout: 30000 },
    );
  });

  describe("streaming structured outputs (streamObject)", () => {
    // Schema for streaming test
    const MovieSchema = Schema.Struct({
      title: Schema.String,
      year: Schema.Number,
      genre: Schema.String,
      director: Schema.String,
    });

    skipIfNoApiKey(
      "should stream object deltas and emit final value",
      async () => {
        const deltas: Array<{ type: string; accumulated?: string }> = [];
        let finalValue: unknown = null;

        const stream = LanguageModel.streamObject({
          prompt: "Create a fictional movie from the 1990s in the sci-fi genre.",
          schema: MovieSchema,
          objectName: "movie",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              if (part.type === "object-delta") {
                deltas.push({
                  type: part.type,
                  accumulated: part.accumulated.slice(0, 50),
                });
              } else if (part.type === "object-done") {
                finalValue = part.value;
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Should have received delta parts
        expect(deltas.length).toBeGreaterThan(0);
        expect(deltas.every((d) => d.type === "object-delta")).toBe(true);

        // Should have final validated value
        expect(finalValue).toBeDefined();
        const movie = finalValue as typeof MovieSchema.Type;
        expect(typeof movie.title).toBe("string");
        expect(typeof movie.year).toBe("number");
        expect(movie.year).toBeGreaterThanOrEqual(1990);
        expect(movie.year).toBeLessThan(2000);
        expect(typeof movie.genre).toBe("string");
        expect(typeof movie.director).toBe("string");
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should provide partial objects during streaming",
      async () => {
        const partials: Array<unknown> = [];

        const PersonSchema = Schema.Struct({
          name: Schema.String,
          age: Schema.Number,
          occupation: Schema.String,
          hobbies: Schema.Array(Schema.String),
        });

        const stream = LanguageModel.streamObject({
          prompt:
            "Create a person named Alice who is 28 years old, works as a software engineer, and has hobbies including reading and hiking.",
          schema: PersonSchema,
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              if (part.type === "object-delta" && part.partial !== undefined) {
                partials.push(part.partial);
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Should have some partial objects (progressive parsing)
        expect(partials.length).toBeGreaterThan(0);

        // At least some partials should have properties
        const nonEmptyPartials = partials.filter(
          (p) => p && typeof p === "object" && Object.keys(p).length > 0,
        );
        expect(nonEmptyPartials.length).toBeGreaterThan(0);
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should stream complex nested objects",
      async () => {
        const deltas: Array<string> = [];
        let finalValue: unknown = null;

        const TeamSchema = Schema.Struct({
          name: Schema.String,
          members: Schema.Array(
            Schema.Struct({
              name: Schema.String,
              role: Schema.String,
            }),
          ),
          project: Schema.Struct({
            title: Schema.String,
            deadline: Schema.String,
          }),
        });

        const stream = LanguageModel.streamObject({
          prompt:
            "Create a software development team with 2 members working on a mobile app project.",
          schema: TeamSchema,
          objectName: "team",
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              if (part.type === "object-delta") {
                deltas.push(part.delta);
              } else if (part.type === "object-done") {
                finalValue = part.value;
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Should have received deltas
        expect(deltas.length).toBeGreaterThan(0);

        // Should have final value with nested structure
        expect(finalValue).toBeDefined();
        const team = finalValue as typeof TeamSchema.Type;
        expect(typeof team.name).toBe("string");
        expect(Array.isArray(team.members)).toBe(true);
        expect(team.members.length).toBe(2);
        expect(team.members[0].name).toBeDefined();
        expect(team.members[0].role).toBeDefined();
        expect(team.project.title).toBeDefined();
        expect(team.project.deadline).toBeDefined();
      },
      { timeout: 60000 },
    );
  });

  // =============================================================================
  // AgentRunner Tests
  // =============================================================================

  describe("AgentRunner", () => {
    skipIfNoApiKey(
      "should complete multi-turn tool calling with ReAct loop",
      async () => {
        // This prompt requires multiple tool calls to compute the result
        const program = LanguageModel.generateText({
          prompt:
            "I need to calculate: (5 + 3) * 2. First add 5 and 3, then multiply the result by 2. Use the calculator tool for each step and tell me the final answer.",
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Should have completed with stop (not tool-calls)
        expect(result.finishReason).toBe("stop");
        // Should have made multiple tool calls
        expect(result.toolCalls.length).toBeGreaterThanOrEqual(2);
        // Final text should contain the answer (16)
        expect(result.text).toContain("16");
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should accumulate tool results from multiple turns",
      async () => {
        const program = LanguageModel.generateText({
          prompt:
            "Calculate these three things and tell me all results: 10+5, 20-8, and 6*7. Use the calculator for each.",
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("stop");
        // Should have at least 3 tool calls (one for each calculation)
        expect(result.toolCalls.length).toBeGreaterThanOrEqual(3);
        // Should have matching tool results
        expect(result.toolResults.length).toBe(result.toolCalls.length);

        // Verify results contain expected values
        const results = result.toolResults.map((r) => r.result);
        expect(results).toContain(15); // 10+5
        expect(results).toContain(12); // 20-8
        expect(results).toContain(42); // 6*7
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should respect maxTurns configuration",
      async () => {
        // Use a very low maxTurns to force early termination
        const customConfig = Layer.succeed(AgentRunner.Config, { maxTurns: 1 });

        const program = LanguageModel.generateText({
          prompt:
            "Calculate (10 + 5) * 3. Use the calculator tool for each step.",
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(customConfig),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // With maxTurns=1, should stop after first turn even if tool calls remain
        // The model will either return tool-calls (hit max) or stop (completed in 1 turn)
        expect(result.toolCalls.length).toBeGreaterThan(0);
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should work without AgentRunner for single-turn tool calls",
      async () => {
        // Baseline test: without AgentRunner, tool calls are resolved but loop doesn't continue
        const program = LanguageModel.generateText({
          prompt: "What is 7 + 8? Use the calculator tool.",
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          // Note: NO AgentRunner.ReAct provided
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Without AgentRunner, should return after tool resolution
        expect(result.finishReason).toBe("tool-calls");
        expect(result.toolCalls.length).toBe(1);
        expect(result.toolResults.length).toBe(1);
        expect(result.toolResults[0].result).toBe(15);
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should stream multi-turn conversations",
      async () => {
        const parts: Array<{ type: string; name?: string }> = [];
        let finishCount = 0;

        const stream = LanguageModel.streamText({
          prompt: "Add 100 and 200, then subtract 50 from the result. Use calculator.",
          toolkit: CalculatorToolkit,
        });

        await stream.pipe(
          Stream.tap((part) =>
            Effect.sync(() => {
              if (part.type === "tool-call") {
                parts.push({ type: part.type, name: part.name });
              } else if (part.type === "tool-result") {
                parts.push({ type: part.type, name: part.name });
              } else if (part.type === "finish") {
                finishCount++;
                parts.push({ type: part.type });
              } else if (part.type === "text-delta") {
                parts.push({ type: part.type });
              }
            }),
          ),
          Stream.runDrain,
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        // Should have tool calls and results
        expect(parts.some((p) => p.type === "tool-call")).toBe(true);
        expect(parts.some((p) => p.type === "tool-result")).toBe(true);
        // Should have text in the final response
        expect(parts.some((p) => p.type === "text-delta")).toBe(true);
        // Should have multiple finish parts (one per turn)
        expect(finishCount).toBeGreaterThanOrEqual(2);
      },
      { timeout: 60000 },
    );

    skipIfNoApiKey(
      "should work with generateObject in ReAct loop",
      async () => {
        const CalculationResultSchema = Schema.Struct({
          expression: Schema.String,
          result: Schema.Number,
          steps: Schema.Array(Schema.String),
        });

        const program = LanguageModel.generateObject({
          prompt:
            "Calculate 25 * 4 using the calculator and return the result in structured format.",
          schema: CalculationResultSchema,
          toolkit: CalculatorToolkit,
        });

        const result = await program.pipe(
          Effect.provide(CalculatorToolkitLive),
          Effect.provide(AgentRunner.ReAct),
          Effect.provide(AgentRunner.defaultConfig),
          Effect.provide(Gpt4oMini),
          Effect.provide(Dedalus),
          Effect.runPromise,
        );

        expect(result.finishReason).toBe("stop");
        expect(result.value).toBeDefined();
        expect(result.value.result).toBe(100);
        expect(typeof result.value.expression).toBe("string");
        expect(Array.isArray(result.value.steps)).toBe(true);
      },
      { timeout: 60000 },
    );
  });
});
