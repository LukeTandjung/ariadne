/**
 * Test script for streaming functionality.
 * Run with: bun packages/dedalus-labs/scripts/test-streaming.ts
 */
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { LanguageModel, IdGenerator } from "@src/ariadne";
import * as DedalusClient from "../../src/DedalusClient.js";
import * as DedalusLanguageModel from "../../src/DedalusLanguageModel.js";

const apiKey = process.env.DEDALUS_API_KEY;

if (!apiKey) {
  console.error("Please set DEDALUS_API_KEY environment variable");
  process.exit(1);
}

const program = Effect.gen(function* () {
  console.log("Starting streaming test...\n");

  let fullText = "";

  const stream = LanguageModel.streamText({
    prompt: "Write a haiku about programming in TypeScript.",
  });

  yield* stream.pipe(
    Stream.tap((part) =>
      Effect.sync(() => {
        switch (part.type) {
          case "response-metadata":
            console.log(`[metadata] id=${Option.getOrElse(part.id, () => "?")} model=${Option.getOrElse(part.modelId, () => "?")}`);
            break;
          case "text-delta":
            process.stdout.write(part.delta);
            fullText += part.delta;
            break;
          case "text":
            console.log(`\n[text] ${part.text}`);
            break;
          case "finish":
            console.log(`\n\n[finish] reason=${part.reason}`);
            if (part.usage) {
              console.log(
                `[usage] input=${part.usage.inputTokens} output=${part.usage.outputTokens}`,
              );
            }
            break;
          default:
            console.log(`[${part.type}]`, part);
        }
      }),
    ),
    Stream.runDrain,
  );

  console.log("\n--- Full response ---");
  console.log(fullText);
});

// DedalusClient needs HttpClient (from FetchHttpClient)
const DedalusClientLive = DedalusClient.layer({
  apiKey: Redacted.make(apiKey),
}).pipe(Layer.provide(FetchHttpClient.layer));

// DedalusLanguageModel needs DedalusClient
const DedalusLanguageModelLive = DedalusLanguageModel.layer({
  model: "anthropic/claude-sonnet-4-20250514",
}).pipe(Layer.provide(DedalusClientLive));

// Combine all layers
const layers = Layer.mergeAll(
  DedalusLanguageModelLive,
  Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
);

program.pipe(Effect.provide(layers), Effect.runPromise).catch(console.error);
