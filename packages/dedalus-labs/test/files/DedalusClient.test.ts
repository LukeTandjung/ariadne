import { describe, expect, test } from "bun:test";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as DedalusClient from "../../src/DedalusClient.js";
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

const mockEmbeddingResponse: typeof Generated.CreateEmbeddingResponse.Encoded =
  {
    object: "list",
    data: [
      {
        object: "embedding",
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        index: 0,
      },
    ],
    model: "openai/text-embedding-3-small",
    usage: {
      prompt_tokens: 5,
      total_tokens: 5,
    },
  };

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

describe("DedalusClient", () => {
  describe("createChatCompletion", () => {
    test("should return parsed response", async () => {
      const program = Effect.gen(function* () {
        const client = yield* DedalusClient.DedalusClient;
        return yield* client.createChatCompletion({
          model: "openai/gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        });
      });

      const result = await program.pipe(
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockChatCompletion)),
        Effect.runPromise,
      );

      expect(result.id).toBe("chatcmpl-123");
      expect(result.model).toBe("openai/gpt-4o");
      expect(result.choices[0].message.content).toBe(
        "Hello! How can I help you today?",
      );
    });
  });

  describe("createEmbedding", () => {
    test("should return parsed embedding response", async () => {
      const program = Effect.gen(function* () {
        const client = yield* DedalusClient.DedalusClient;
        return yield* client.createEmbedding({
          model: "openai/text-embedding-3-small",
          input: "Hello, world!",
        });
      });

      const result = await program.pipe(
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockEmbeddingResponse)),
        Effect.runPromise,
      );

      expect(result.object).toBe("list");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(result.data[0].index).toBe(0);
    });
  });
});
