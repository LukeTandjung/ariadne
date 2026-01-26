/**
 * Test model array and MCP servers
 */
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { LanguageModel, IdGenerator, McpRegistry } from "@luketandjung/ariadne";
import * as DedalusClient from "../../src/DedalusClient.js";
import * as DedalusLanguageModel from "../../src/DedalusLanguageModel.js";

const apiKey = process.env.DEDALUS_API_KEY;
if (!apiKey) {
  console.error("Please set DEDALUS_API_KEY");
  process.exit(1);
}

const DedalusClientLive = DedalusClient.layer({
  apiKey: Redacted.make(apiKey),
}).pipe(Layer.provide(FetchHttpClient.layer));

// =============================================================================
// Test 1: Model Array (multi-model routing)
// =============================================================================
async function testModelArray() {
  console.log("\n=== Test 1: Model Array ===\n");

  const myModel = DedalusLanguageModel.model([
    "openai/gpt-4o-mini",
    "anthropic/claude-sonnet-4-20250514",
  ]);

  const layers = Layer.mergeAll(
    myModel,
    Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
  ).pipe(Layer.provide(DedalusClientLive));

  const result = await LanguageModel.generateText({
    prompt: "Say hello in one word.",
  }).pipe(Effect.provide(layers), Effect.runPromise);

  console.log("Response:", result.text);
}

// =============================================================================
// Test 2: MCP Server (web search with Exa)
// =============================================================================
async function testMcpServer() {
  console.log("\n=== Test 2: MCP Server (Exa Web Search) ===\n");

  const myModel = DedalusLanguageModel.model("openai/gpt-4o-mini");

  const layers = Layer.mergeAll(
    myModel,
    Layer.succeed(IdGenerator.IdGenerator, IdGenerator.defaultIdGenerator),
  ).pipe(Layer.provide(DedalusClientLive));

  const result = await LanguageModel.generateText({
    prompt: "Search the web for the latest TypeScript 5.7 features and summarize them.",
    mcpServers: [McpRegistry.marketplace("tsion/exa")],
  }).pipe(Effect.provide(layers), Effect.runPromise);

  console.log("Finish reason:", result.finishReason);
  console.log("Response:", result.text.slice(0, 300) + "...");
}

// =============================================================================
// Run tests
// =============================================================================
async function main() {
  try {
    await testModelArray();
  } catch (e) {
    console.error("Test 1 failed:", e);
  }

  try {
    await testMcpServer();
  } catch (e) {
    console.error("Test 2 failed:", e);
  }
}

main();
