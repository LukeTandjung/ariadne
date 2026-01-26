import * as Sse from "@effect/experimental/Sse";
import * as HttpBody from "@effect/platform/HttpBody";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
/**
 * @since 1.0.0
 */
import { AiError } from "@luketandjung/ariadne";
import * as Config from "effect/Config";
import type { ConfigError } from "effect/ConfigError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Generated from "./Generated.js";
import { DedalusConfig } from "./DedalusConfig.js";
import { uuid4 } from "./internal/utilities.js";

/**
 * @since 1.0.0
 * @category Context
 */
export class DedalusClient extends Context.Tag("@dedalus-labs/DedalusClient")<
  DedalusClient,
  Service
>() {}

/**
 * @since 1.0.0
 * @category Models
 */
export interface Service {
  readonly client: Generated.Client;

  readonly createChatCompletion: (
    options: typeof Generated.ChatCompletionRequest.Encoded,
  ) => Effect.Effect<Generated.ChatCompletion, AiError.AiError>;

  readonly createChatCompletionStream: (
    options: Omit<typeof Generated.ChatCompletionRequest.Encoded, "stream">,
  ) => Stream.Stream<ChatCompletionChunk, AiError.AiError>;

  readonly createEmbedding: (
    options: typeof Generated.CreateEmbeddingRequest.Encoded,
  ) => Effect.Effect<Generated.CreateEmbeddingResponse, AiError.AiError>;
}

/**
 * @since 1.0.0
 * @category Models
 */
export type StreamChatCompletionRequest = Omit<
  typeof Generated.ChatCompletionRequest.Encoded,
  "stream"
>;

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make = (options: {
  /**
   * Standard OAuth-style API key to use to communicate with the Dedalus API.
   */
  readonly apiKey?: Redacted.Redacted | undefined;
  /**
   * An alternative API gateway/proxy style API key to use to communicate with the Dedalus API.
   */
  readonly xApiKey?: Redacted.Redacted | undefined;
  /**
   * The model provider. Only for users with access to and using BYOK API key.
   */
  readonly provider?: string | undefined;
  /**
   * The model provider key. Only for users with access to and using BYOK API key.
   */
  readonly providerKey?: Redacted.Redacted | undefined;
  /**
   * The environment to use. Determines the base URL if `apiUrl` is not provided.
   * - `"production"` uses https://api.dedaluslabs.ai/v1
   * - `"development"` uses http://localhost:8080/v1
   * Defaults to `"production"`.
   */
  readonly environment?: "production" | "development" | undefined;
  /**
   * The URL to use to communicate with the Dedalus API.
   * Overrides the `environment` setting if provided.
   */
  readonly apiUrl?: string | undefined;
  /**
   * A method which can be used to transform the underlying `HttpClient` which
   * will be used to communicate with the Dedalus API.
   */
  readonly transformClient?:
    | ((client: HttpClient.HttpClient) => HttpClient.HttpClient)
    | undefined;
}): Effect.Effect<Service, never, HttpClient.HttpClient | Scope.Scope> =>
  Effect.gen(function* () {
    const baseUrl =
      options.apiUrl ??
      ((options.environment ?? "production") === "production"
        ? "https://api.dedaluslabs.ai"
        : "http://localhost:8080");

    const httpClient = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest((request) => {
        const headers: Record<string, string> = {
          "User-Agent": "Dedalus/JS 1.0.0",
          "X-SDK-Version": "1.0.0",
        };

        if (options.provider) {
          headers["X-Provider"] = options.provider;
        }
        if (options.providerKey) {
          headers["X-Provider-Key"] = Redacted.value(options.providerKey);
        }
        if (request.method !== "GET") {
          headers["Idempotency-Key"] = `stainless-node-retry-${uuid4()}`;
        }

        return request.pipe(
          HttpClientRequest.prependUrl(baseUrl),
          options.apiKey
            ? HttpClientRequest.bearerToken(options.apiKey)
            : options.xApiKey
              ? HttpClientRequest.setHeader(
                  "x-api-key",
                  Redacted.value(options.xApiKey),
                )
              : identity,
          HttpClientRequest.setHeaders(headers),
          HttpClientRequest.acceptJson,
        );
      }),
      options.transformClient ?? identity,
    );

    const httpClientOk = HttpClient.filterStatusOk(httpClient);

    const client = Generated.make(httpClient, {
      transformClient: (client) =>
        DedalusConfig.getOrUndefined.pipe(
          Effect.map((config) =>
            config?.transformClient ? config.transformClient(client) : client,
          ),
        ),
    });

    const createChatCompletion = (
      options: typeof Generated.ChatCompletionRequest.Encoded,
    ): Effect.Effect<Generated.ChatCompletion, AiError.AiError> =>
      client.createChatCompletionV1ChatCompletionsPost(options).pipe(
        Effect.catchTags({
          RequestError: (error) =>
            AiError.HttpRequestError.fromRequestError({
              module: "DedalusClient",
              method: "createChatCompletion",
              error,
            }),
          ResponseError: (error) =>
            AiError.HttpResponseError.fromResponseError({
              module: "DedalusClient",
              method: "createChatCompletion",
              error,
            }),
          ParseError: (error) =>
            AiError.MalformedOutput.fromParseError({
              module: "DedalusClient",
              method: "createChatCompletion",
              error,
            }),
        }),
      );

    const createChatCompletionStream = (
      options: Omit<typeof Generated.ChatCompletionRequest.Encoded, "stream">,
    ): Stream.Stream<ChatCompletionChunk, AiError.AiError> => {
      const request = HttpClientRequest.post("/v1/chat/completions", {
        body: HttpBody.unsafeJson({ ...options, stream: true }),
      });
      const decodeChunk = Schema.decode(Schema.parseJson(ChatCompletionChunk));
      return httpClientOk.execute(request).pipe(
        Effect.map((r) => r.stream),
        Stream.unwrapScoped,
        Stream.decodeText(),
        Stream.pipeThroughChannel(Sse.makeChannel()),
        Stream.mapEffect((event) => decodeChunk(event.data)),
        Stream.takeUntil((chunk) =>
          chunk.choices.some((choice) => choice.finish_reason !== null),
        ),
        Stream.catchTags({
          RequestError: (error) =>
            AiError.HttpRequestError.fromRequestError({
              module: "DedalusClient",
              method: "createChatCompletionStream",
              error,
            }),
          ResponseError: (error) =>
            AiError.HttpResponseError.fromResponseError({
              module: "DedalusClient",
              method: "createChatCompletionStream",
              error,
            }),
          ParseError: (error) =>
            AiError.MalformedOutput.fromParseError({
              module: "DedalusClient",
              method: "createChatCompletionStream",
              error,
            }),
        }),
      );
    };

    const createEmbedding = (
      options: typeof Generated.CreateEmbeddingRequest.Encoded,
    ): Effect.Effect<Generated.CreateEmbeddingResponse, AiError.AiError> =>
      client.createEmbeddingsV1EmbeddingsPost(options).pipe(
        Effect.catchTags({
          RequestError: (error) =>
            AiError.HttpRequestError.fromRequestError({
              module: "DedalusClient",
              method: "createEmbedding",
              error,
            }),
          ResponseError: (error) =>
            AiError.HttpResponseError.fromResponseError({
              module: "DedalusClient",
              method: "createEmbedding",
              error,
            }),
          ParseError: (error) =>
            AiError.MalformedOutput.fromParseError({
              module: "DedalusClient",
              method: "createEmbedding",
              error,
            }),
        }),
      );

    return DedalusClient.of({
      client,
      createChatCompletion,
      createChatCompletionStream,
      createEmbedding,
    });
  });

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = (options: {
  readonly apiKey?: Redacted.Redacted | undefined;
  readonly xApiKey?: Redacted.Redacted | undefined;
  readonly provider?: string | undefined;
  readonly providerKey?: Redacted.Redacted | undefined;
  readonly environment?: "production" | "development" | undefined;
  readonly apiUrl?: string | undefined;
  readonly transformClient?: (
    client: HttpClient.HttpClient,
  ) => HttpClient.HttpClient;
}): Layer.Layer<DedalusClient, never, HttpClient.HttpClient> =>
  Layer.scoped(DedalusClient, make(options));

/**
 * @since 1.0.0
 * @category Layers
 */
export const layerConfig = (options: {
  readonly apiKey?: Config.Config<Redacted.Redacted | undefined> | undefined;
  readonly xApiKey?: Config.Config<Redacted.Redacted | undefined> | undefined;
  readonly provider?: Config.Config<string | undefined> | undefined;
  readonly providerKey?:
    | Config.Config<Redacted.Redacted | undefined>
    | undefined;
  readonly environment?:
    | Config.Config<"production" | "development" | undefined>
    | undefined;
  readonly apiUrl?: Config.Config<string | undefined> | undefined;
  readonly transformClient?: (
    client: HttpClient.HttpClient,
  ) => HttpClient.HttpClient;
}): Layer.Layer<DedalusClient, ConfigError, HttpClient.HttpClient> => {
  const { transformClient, ...configs } = options;
  return Config.all(configs).pipe(
    Effect.flatMap((configs) => make({ ...configs, transformClient })),
    Layer.scoped(DedalusClient),
  );
};

// =============================================================================
// Chat Completion Streaming Schema (OpenAI-compatible)
// =============================================================================

/**
 * A delta message in a streaming chat completion chunk.
 *
 * @since 1.0.0
 * @category Schemas
 */
export class ChatCompletionChunkDelta extends Schema.Class<ChatCompletionChunkDelta>(
  "@dedalus-labs/ChatCompletionChunkDelta",
)({
  /**
   * The role of the author of this message delta.
   */
  role: Schema.optional(
    Schema.Literal("developer", "system", "user", "assistant", "tool"),
  ),
  /**
   * The content delta.
   */
  content: Schema.optional(Schema.NullOr(Schema.String)),
  /**
   * The refusal message delta.
   */
  refusal: Schema.optional(Schema.NullOr(Schema.String)),
  /**
   * Tool calls delta.
   */
  tool_calls: Schema.optional(
    Schema.Array(
      Schema.Struct({
        index: Schema.Int,
        id: Schema.optional(Schema.String),
        type: Schema.optional(Schema.Literal("function")),
        function: Schema.optional(
          Schema.Struct({
            name: Schema.optional(Schema.String),
            arguments: Schema.optional(Schema.String),
          }),
        ),
      }),
    ),
  ),
}) {}

/**
 * A choice in a streaming chat completion chunk.
 *
 * @since 1.0.0
 * @category Schemas
 */
export class ChatCompletionChunkChoice extends Schema.Class<ChatCompletionChunkChoice>(
  "@dedalus-labs/ChatCompletionChunkChoice",
)({
  /**
   * The index of this choice.
   */
  index: Schema.Int,
  /**
   * The delta content.
   */
  delta: ChatCompletionChunkDelta,
  /**
   * Log probability information.
   */
  logprobs: Schema.optional(Schema.NullOr(Generated.ChoiceLogprobs)),
  /**
   * The reason the model stopped generating tokens.
   */
  finish_reason: Schema.NullOr(Generated.ChoiceFinishReasonEnum),
}) {}

/**
 * A streaming chat completion chunk (OpenAI-compatible).
 *
 * @since 1.0.0
 * @category Schemas
 */
export class ChatCompletionChunk extends Schema.Class<ChatCompletionChunk>(
  "@dedalus-labs/ChatCompletionChunk",
)({
  /**
   * A unique identifier for the chat completion chunk.
   */
  id: Schema.String,
  /**
   * The object type, which is always `chat.completion.chunk`.
   */
  object: Schema.Literal("chat.completion.chunk"),
  /**
   * The Unix timestamp (in seconds) of when the chunk was created.
   */
  created: Schema.Int,
  /**
   * The model used for the chat completion.
   */
  model: Schema.String,
  /**
   * This fingerprint represents the backend configuration that the model runs with.
   */
  system_fingerprint: Schema.optional(Schema.NullOr(Schema.String)),
  /**
   * A list of chat completion choices.
   */
  choices: Schema.Array(ChatCompletionChunkChoice),
  /**
   * Usage statistics (only present in final chunk if requested).
   */
  usage: Schema.optional(Schema.NullOr(Generated.CompletionUsage)),
  /**
   * Service tier used for processing the request.
   */
  service_tier: Schema.optional(
    Schema.NullOr(Generated.ChatCompletionServiceTierEnum),
  ),
}) {}

