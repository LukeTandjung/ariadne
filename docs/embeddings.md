# Embeddings

Generate vector embeddings for semantic search, similarity, and clustering.

## Basic Usage

```typescript
import { EmbeddingModel } from "@luketandjung/ariadne"
import { DedalusClient, DedalusEmbeddingModel } from "@luketandjung/dedalus-labs"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Effect, Layer } from "effect"

// Create the embedding model
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
)

// Create the client
const Dedalus = DedalusClient.layer({
  apiKey: Redacted.make(process.env.DEDALUS_API_KEY!),
}).pipe(Layer.provide(FetchHttpClient.layer))

const program = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // Single embedding
  const vector = yield* model.embed("Hello, world!")
  console.log(vector.length) // 1536 dimensions

  // Multiple embeddings
  const vectors = yield* model.embedMany([
    "First document",
    "Second document",
  ])
  console.log(vectors.length) // 2
})

program.pipe(
  Effect.provide(TextEmbedding),
  Effect.provide(Dedalus),
  Effect.runPromise,
)
```

## Embedding Modes

### Batched Mode

Automatically batches concurrent requests into a single API call:

```typescript
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "batched" },
)

const program = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // These 3 concurrent calls are batched into 1 API request
  const [v1, v2, v3] = yield* Effect.all([
    model.embed("Text 1"),
    model.embed("Text 2"),
    model.embed("Text 3"),
  ])
})
```

### Data Loader Mode

Batches requests within a time window:

```typescript
const TextEmbedding = DedalusEmbeddingModel.model(
  "openai/text-embedding-3-small",
  { mode: "data-loader", window: "100 millis" },
)

const program = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // All requests within 100ms are batched together
  const vectors = yield* Effect.all([
    model.embed("Text 1"),
    model.embed("Text 2"),
  ])
}).pipe(Effect.scoped)  // Note: requires scoped for data-loader
```

## EmbeddingModel Service

The `EmbeddingModel.EmbeddingModel` service provides:

```typescript
interface EmbeddingModel {
  // Embed a single text
  embed(text: string): Effect<Array<number>>

  // Embed multiple texts
  embedMany(texts: Array<string>): Effect<Array<Array<number>>>
}
```

## Available Models

Use Dedalus model format:

```typescript
// OpenAI
DedalusEmbeddingModel.model("openai/text-embedding-3-small")
DedalusEmbeddingModel.model("openai/text-embedding-3-large")
DedalusEmbeddingModel.model("openai/text-embedding-ada-002")
```

## Configuration Override

Override configuration for specific calls:

```typescript
import { DedalusEmbeddingModel } from "@luketandjung/dedalus-labs"

const program = model.embed("text")

// Override dimensions for this call
const withDimensions = DedalusEmbeddingModel.withConfigOverride(
  { dimensions: 512 },
  program,
)
```

## Use Cases

### Semantic Search

```typescript
const searchDocuments = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // Embed the query
  const queryVector = yield* model.embed("How do I use TypeScript?")

  // Embed documents (in practice, pre-compute these)
  const docVectors = yield* model.embedMany(documents)

  // Find most similar (using cosine similarity)
  const similarities = docVectors.map((docVector, i) => ({
    index: i,
    similarity: cosineSimilarity(queryVector, docVector),
  }))

  return similarities.sort((a, b) => b.similarity - a.similarity)
})
```

### Document Clustering

```typescript
const clusterDocuments = Effect.gen(function* () {
  const model = yield* EmbeddingModel.EmbeddingModel

  // Embed all documents
  const vectors = yield* model.embedMany(documents)

  // Use vectors for clustering algorithm (k-means, etc.)
  return cluster(vectors)
})
```

## Next Steps

- [Configuration](./configuration.md) - Configure embedding models
- [Error Handling](./error-handling.md) - Handle embedding errors
