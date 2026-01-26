import { describe, expect, test } from "bun:test";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { EmbeddingModel } from "@luketandjung/ariadne";
import * as DedalusClient from "../../src/DedalusClient.js";
import * as DedalusEmbeddingModel from "../../src/DedalusEmbeddingModel.js";
import * as Generated from "../../src/Generated.js";

// =============================================================================
// Test Fixtures
// =============================================================================

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

const mockBatchEmbeddingResponse: typeof Generated.CreateEmbeddingResponse.Encoded =
  {
    object: "list",
    data: [
      {
        object: "embedding",
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        index: 0,
      },
      {
        object: "embedding",
        embedding: [0.6, 0.7, 0.8, 0.9, 1.0],
        index: 1,
      },
    ],
    model: "openai/text-embedding-3-small",
    usage: {
      prompt_tokens: 10,
      total_tokens: 10,
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

describe("DedalusEmbeddingModel", () => {
  describe("embed", () => {
    test("should embed a single text", async () => {
      const program = Effect.gen(function* () {
        const model = yield* EmbeddingModel.EmbeddingModel;
        return yield* model.embed("Hello, world!");
      });

      const result = await program.pipe(
        Effect.provide(
          DedalusEmbeddingModel.layerBatched({
            model: "openai/text-embedding-3-small",
          }),
        ),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockEmbeddingResponse)),
        Effect.runPromise,
      );

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    test("should embed multiple texts", async () => {
      const program = Effect.gen(function* () {
        const model = yield* EmbeddingModel.EmbeddingModel;
        return yield* model.embedMany(["Hello", "World"]);
      });

      const result = await program.pipe(
        Effect.provide(
          DedalusEmbeddingModel.layerBatched({
            model: "openai/text-embedding-3-small",
          }),
        ),
        Effect.provide(DedalusClient.layer({})),
        Effect.provide(createMockHttpClient(mockBatchEmbeddingResponse)),
        Effect.runPromise,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(result[1]).toEqual([0.6, 0.7, 0.8, 0.9, 1.0]);
    });
  });
});
