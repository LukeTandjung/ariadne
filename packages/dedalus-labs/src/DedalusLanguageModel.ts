/**
 * @since 1.0.0
 */
import {
  AiError,
  Model as AiModel,
  IdGenerator,
  LanguageModel,
  McpRegistry,
  type Response,
  Tool,
} from "@luketandjung/ariadne";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import type { Simplify } from "effect/Types";
import * as Generated from "./Generated.js";
import { DedalusClient, type ChatCompletionChunk } from "./DedalusClient.js";

/**
 * @since 1.0.0
 * @category Models
 */
export type Model =
  | typeof Generated.DedalusModelChoice.Encoded
  | typeof Generated.Models.Encoded;

// =============================================================================
// Configuration
// =============================================================================

/**
 * @since 1.0.0
 * @category Context
 */
export class Config extends Context.Tag(
  "@dedalus-labs/DedalusLanguageModel/Config",
)<Config, Config.Service>() {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<Config.Service | undefined> =
    Effect.map(Effect.context<never>(), (context) =>
      context.unsafeMap.get(Config.key),
    );
}

/**
 * @since 1.0.0
 */
export declare namespace Config {
  /**
   * @since 1.0.0
   * @category Models
   */
  export interface Service
    extends Simplify<
      Partial<
        Omit<
          typeof Generated.ChatCompletionRequest.Encoded,
          | "messages"
          | "input"
          | "instructions"
          | "system"
          | "tools"
          | "tool_choice"
          | "response_format"
          | "stream"
        >
      >
    > {}
}

// =============================================================================
// Dedalus Language Model
// =============================================================================

/**
 * @since 1.0.0
 * @category Ai Models
 */
export const model = (
  model: (string & {}) | Model,
  config?: Omit<Config.Service, "model">,
): AiModel.Model<"dedalus-labs", LanguageModel.LanguageModel, DedalusClient> =>
  AiModel.make("dedalus-labs", layer({ model, config }));

/**
 * @since 1.0.0
 * @category Constructors
 */
export const make = Effect.fnUntraced(function* (options: {
  readonly model: (string & {}) | Model;
  readonly config?: Omit<Config.Service, "model">;
}) {
  const client = yield* DedalusClient;

  const makeRequest: (
    providerOptions: LanguageModel.ProviderOptions,
  ) => Effect.Effect<
    typeof Generated.ChatCompletionRequest.Encoded,
    AiError.AiError
  > = Effect.fnUntraced(function* (providerOptions) {
    const context = yield* Effect.context<never>();
    const config = {
      model: options.model,
      ...options.config,
      ...context.unsafeMap.get(Config.key),
    };
    const messages = yield* prepareMessages(providerOptions);
    const { toolChoice, tools } = yield* prepareTools(providerOptions);
    const responseFormat = prepareResponseFormat(providerOptions);

    const request: typeof Generated.ChatCompletionRequest.Encoded = {
      ...config,
      messages,
      tools,
      tool_choice: toolChoice,
      response_format: responseFormat,
      mcp_servers:
        providerOptions.mcpServers.length > 0
          ? McpRegistry.toApiFormat(providerOptions.mcpServers)
          : undefined,
    };
    return request;
  });

  return yield* LanguageModel.make({
    generateText: Effect.fnUntraced(function* (options) {
      const request = yield* makeRequest(options);
      const rawResponse = yield* client.createChatCompletion(request);
      return yield* makeResponse(rawResponse, options);
    }),
    streamText: Effect.fnUntraced(
      function* (options) {
        const request = yield* makeRequest(options);
        return client.createChatCompletionStream(request);
      },
      (effect, options) =>
        effect.pipe(
          Effect.flatMap((stream) => makeStreamResponse(stream, options)),
          Stream.unwrap,
        ),
    ),
  });
});

/**
 * @since 1.0.0
 * @category Layers
 */
export const layer = (options: {
  readonly model: (string & {}) | Model;
  readonly config?: Omit<Config.Service, "model">;
}): Layer.Layer<LanguageModel.LanguageModel, never, DedalusClient> =>
  Layer.effect(
    LanguageModel.LanguageModel,
    make({ model: options.model, config: options.config }),
  );

/**
 * @since 1.0.0
 * @category Configuration
 */
export const withConfigOverride: {
  (
    overrides: Config.Service,
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    overrides: Config.Service,
  ): Effect.Effect<A, E, R>;
} = dual<
  (
    overrides: Config.Service,
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    overrides: Config.Service,
  ) => Effect.Effect<A, E, R>
>(2, (self, overrides) =>
  Effect.flatMap(Config.getOrUndefined, (config) =>
    Effect.provideService(self, Config, { ...config, ...overrides }),
  ),
);

// =============================================================================
// Prompt Conversion
// =============================================================================

/**
 * Chat Completions message format (OpenAI-compatible).
 */
type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }
  | { role: "tool"; content: string; tool_call_id: string };

const prepareMessages = (
  options: LanguageModel.ProviderOptions,
): Effect.Effect<ReadonlyArray<ChatMessage>, AiError.AiError> =>
  Effect.gen(function* () {
    const messages: Array<ChatMessage> = [];

    for (const message of options.prompt.content) {
      switch (message.role) {
        case "system": {
          messages.push({
            role: "system",
            content: message.content,
          });
          break;
        }

        case "user": {
          // Collect all text parts into a single string
          const textParts: Array<string> = [];

          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                textParts.push(part.text);
                break;
              }
              case "file": {
                // Images/files not supported yet
                return yield* new AiError.MalformedInput({
                  module: "DedalusLanguageModel",
                  method: "prepareMessages",
                  description: `File attachments are not yet supported. Received file with media type: '${part.mediaType}'`,
                });
              }
            }
          }

          messages.push({
            role: "user",
            content: textParts.join("\n"),
          });
          break;
        }

        case "assistant": {
          // Collect text content and tool calls separately
          const textParts: Array<string> = [];
          const toolCalls: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }> = [];

          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                textParts.push(part.text);
                break;
              }
              case "tool-call": {
                if (!part.providerExecuted) {
                  toolCalls.push({
                    id: part.id,
                    type: "function",
                    function: {
                      name: part.name,
                      arguments: JSON.stringify(part.params),
                    },
                  });
                }
                break;
              }
              case "reasoning": {
                // Reasoning/thinking is not passed back in Chat Completions format
                break;
              }
            }
          }

          const content = textParts.length > 0 ? textParts.join("\n") : null;

          if (toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              content,
              tool_calls: toolCalls,
            });
          } else if (content !== null) {
            messages.push({
              role: "assistant",
              content,
            });
          }
          break;
        }

        case "tool": {
          for (const part of message.content) {
            messages.push({
              role: "tool",
              tool_call_id: part.id,
              content: JSON.stringify(part.result),
            });
          }
          break;
        }
      }
    }

    return messages;
  });

// =============================================================================
// Response Conversion
// =============================================================================

const makeResponse: (
  response: Generated.ChatCompletion,
  options: LanguageModel.ProviderOptions,
) => Effect.Effect<
  Array<Response.PartEncoded>,
  AiError.AiError,
  IdGenerator.IdGenerator
> = Effect.fnUntraced(function* (response, _options) {
  const idGenerator = yield* IdGenerator.IdGenerator;
  const parts: Array<Response.PartEncoded> = [];

  // Response metadata
  const createdAt = new Date(response.created * 1000);
  parts.push({
    type: "response-metadata",
    id: response.id,
    modelId: response.model,
    timestamp: DateTime.formatIso(DateTime.unsafeFromDate(createdAt)),
  });

  // Process first choice (standard for chat completions)
  const choice = response.choices[0];
  if (choice) {
    const message = choice.message;

    // Text content
    if (message.content !== null && message.content !== undefined) {
      parts.push({
        type: "text",
        text: message.content,
      });
    }

    // Refusal
    if (message.refusal !== null && message.refusal !== undefined) {
      parts.push({
        type: "text",
        text: "",
        metadata: { dedalus: { refusal: message.refusal } },
      });
    }

    // URL citations from annotations
    if (message.annotations) {
      for (const annotation of message.annotations) {
        if (annotation.type === "url_citation") {
          parts.push({
            type: "source",
            sourceType: "url",
            id: yield* idGenerator.generateId(),
            url: annotation.url_citation.url,
            title: annotation.url_citation.title,
            metadata: {
              dedalus: {
                startIndex: annotation.url_citation.start_index,
                endIndex: annotation.url_citation.end_index,
              },
            },
          });
        }
      }
    }

    // Tool calls
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === "function") {
          const toolName = toolCall.function.name;
          const toolParams = toolCall.function.arguments;

          const params = yield* Effect.try({
            try: () => Tool.unsafeSecureJsonParse(toolParams),
            catch: (cause) =>
              new AiError.MalformedOutput({
                module: "DedalusLanguageModel",
                method: "makeResponse",
                description:
                  "Failed to securely parse tool call parameters " +
                  `for tool '${toolName}':\nParameters: ${toolParams}`,
                cause,
              }),
          });

          parts.push({
            type: "tool-call",
            id: toolCall.id,
            name: toolName,
            params,
          });
        } else if (toolCall.type === "custom") {
          // Custom tool calls (e.g., MCP tools) have raw input strings
          const toolName = toolCall.custom.name;
          const toolInput = toolCall.custom.input;

          const params = yield* Effect.try({
            try: () => Tool.unsafeSecureJsonParse(toolInput),
            catch: (cause) =>
              new AiError.MalformedOutput({
                module: "DedalusLanguageModel",
                method: "makeResponse",
                description:
                  "Failed to securely parse custom tool call input " +
                  `for tool '${toolName}':\nInput: ${toolInput}`,
                cause,
              }),
          });

          parts.push({
            type: "tool-call",
            id: toolCall.id,
            name: toolName,
            params,
          });
        }
      }
    }

    // Finish reason
    const hasToolCalls = (message.tool_calls?.length ?? 0) > 0;
    const finishReason = resolveFinishReason(
      choice.finish_reason,
      hasToolCalls,
    );

    parts.push({
      type: "finish",
      reason: finishReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        reasoningTokens:
          response.usage?.completion_tokens_details?.reasoning_tokens,
        cachedInputTokens: response.usage?.prompt_tokens_details?.cached_tokens,
      },
      metadata: {
        dedalus: {
          serviceTier: response.service_tier,
          toolsExecuted: response.tools_executed,
          mcpServerErrors: response.mcp_server_errors,
        },
      },
    });
  }

  // Handle MCP tool executions (server-side executed tools)
  if (response.tools_executed && response.tools_executed.length > 0) {
    for (const toolName of response.tools_executed) {
      parts.push({
        type: "tool-call",
        id: yield* idGenerator.generateId(),
        name: toolName,
        params: {},
        providerExecuted: true,
      });
    }
  }

  return parts;
});

const makeStreamResponse = (
  stream: Stream.Stream<ChatCompletionChunk, AiError.AiError>,
  _options: LanguageModel.ProviderOptions,
): Effect.Effect<
  Stream.Stream<Response.StreamPartEncoded, AiError.AiError>,
  never,
  IdGenerator.IdGenerator
> =>
  Effect.gen(function* () {
    // Track active tool calls being built up
    const activeToolCalls: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();

    let hasEmittedMetadata = false;
    let hasToolCalls = false;

    return stream.pipe(
      Stream.mapEffect(
        Effect.fnUntraced(function* (chunk) {
          const parts: Array<Response.StreamPartEncoded> = [];

          // Emit metadata on first chunk
          if (!hasEmittedMetadata) {
            const createdAt = new Date(chunk.created * 1000);
            parts.push({
              type: "response-metadata",
              id: chunk.id,
              modelId: chunk.model,
              timestamp: DateTime.formatIso(DateTime.unsafeFromDate(createdAt)),
            });
            hasEmittedMetadata = true;
          }

          const choice = chunk.choices[0];
          if (choice) {
            const delta = choice.delta;

            // Text content delta
            if (delta.content !== null && delta.content !== undefined) {
              parts.push({
                type: "text-delta",
                id: chunk.id,
                delta: delta.content,
              });
            }

            // Tool calls delta
            if (delta.tool_calls) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;

                // Initialize tool call tracking if this is a new one
                if (toolCallDelta.id) {
                  activeToolCalls.set(index, {
                    id: toolCallDelta.id,
                    name: toolCallDelta.function?.name ?? "",
                    arguments: "",
                  });
                  parts.push({
                    type: "tool-params-start",
                    id: toolCallDelta.id,
                    name: toolCallDelta.function?.name ?? "",
                  });
                }

                // Accumulate arguments
                const toolCall = activeToolCalls.get(index);
                if (toolCall) {
                  if (toolCallDelta.function?.name) {
                    toolCall.name = toolCallDelta.function.name;
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCall.arguments += toolCallDelta.function.arguments;
                    parts.push({
                      type: "tool-params-delta",
                      id: toolCall.id,
                      delta: toolCallDelta.function.arguments,
                    });
                  }
                }
              }
            }

            // Finish reason indicates end of stream
            if (choice.finish_reason !== null) {
              // Finalize any pending tool calls
              for (const [_index, toolCall] of activeToolCalls) {
                hasToolCalls = true;

                const params = yield* Effect.try({
                  try: () => Tool.unsafeSecureJsonParse(toolCall.arguments),
                  catch: (cause) =>
                    new AiError.MalformedOutput({
                      module: "DedalusLanguageModel",
                      method: "makeStreamResponse",
                      description:
                        "Failed to securely parse tool call parameters " +
                        `for tool '${toolCall.name}':\nParameters: ${toolCall.arguments}`,
                      cause,
                    }),
                });

                parts.push({
                  type: "tool-params-end",
                  id: toolCall.id,
                });

                parts.push({
                  type: "tool-call",
                  id: toolCall.id,
                  name: toolCall.name,
                  params,
                });
              }
              activeToolCalls.clear();

              // Emit finish part
              const finishReason = resolveFinishReason(
                choice.finish_reason,
                hasToolCalls,
              );

              parts.push({
                type: "finish",
                reason: finishReason,
                usage: {
                  inputTokens: chunk.usage?.prompt_tokens,
                  outputTokens: chunk.usage?.completion_tokens,
                  totalTokens: chunk.usage?.total_tokens,
                  reasoningTokens:
                    chunk.usage?.completion_tokens_details?.reasoning_tokens,
                  cachedInputTokens:
                    chunk.usage?.prompt_tokens_details?.cached_tokens,
                },
                metadata: {
                  dedalus: { serviceTier: chunk.service_tier },
                },
              });
            }
          }

          return parts;
        }),
      ),
      Stream.flattenIterables,
    );
  });

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convert Chat Completions finish_reason to LanguageModel finish reason.
 */
const resolveFinishReason = (
  finishReason: string | null | undefined,
  hasToolCalls: boolean,
):
  | "stop"
  | "length"
  | "content-filter"
  | "tool-calls"
  | "error"
  | "unknown" => {
  if (hasToolCalls) return "tool-calls";
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content-filter";
    case "tool_calls":
    case "function_call":
      return "tool-calls";
    default:
      return finishReason ? "unknown" : "stop";
  }
};

// =============================================================================
// Tool Calling
// =============================================================================

/**
 * Chat Completions tool format.
 */
type ChatCompletionTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
};

/**
 * Chat Completions tool_choice format.
 */
type ChatCompletionToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

const prepareTools: (options: LanguageModel.ProviderOptions) => Effect.Effect<
  {
    readonly tools: ReadonlyArray<ChatCompletionTool> | undefined;
    readonly toolChoice: ChatCompletionToolChoice | undefined;
  },
  AiError.AiError
> = Effect.fnUntraced(function* (options) {
  // Return immediately if no tools are in the toolkit
  if (options.tools.length === 0) {
    return { tools: undefined, toolChoice: undefined };
  }

  const tools: Array<ChatCompletionTool> = [];
  let toolChoice: ChatCompletionToolChoice | undefined = undefined;

  // Filter tools based on tool choice constraints
  let allowedTools = options.tools;
  if (typeof options.toolChoice === "object" && "oneOf" in options.toolChoice) {
    const allowedToolNames = new Set(options.toolChoice.oneOf);
    allowedTools = options.tools.filter((tool) =>
      allowedToolNames.has(tool.name),
    );
    toolChoice = options.toolChoice.mode === "required" ? "required" : "auto";
  }

  // Convert tools to Chat Completions format
  for (const tool of allowedTools) {
    if (Tool.isUserDefined(tool)) {
      tools.push({
        type: "function",
        function: {
          name: tool.name,
          description:
            tool.description ??
            Tool.getDescriptionFromSchemaAst(tool.parametersSchema.ast),
          parameters: Tool.getJsonSchemaFromSchemaAst(
            tool.parametersSchema.ast,
          ) as unknown as Record<string, unknown>,
          strict: true,
        },
      });
    }

    // Provider-defined tools are not supported in Chat Completions format
    if (Tool.isProviderDefined(tool)) {
      return yield* new AiError.MalformedInput({
        module: "DedalusLanguageModel",
        method: "prepareTools",
        description: `Provider-defined tools are not supported. Received: '${tool.name}'`,
      });
    }
  }

  // Set tool choice
  // Note: Dedalus API doesn't accept "auto" as a string, so we only set it for "none" and "required"
  if (options.toolChoice === "none" || options.toolChoice === "required") {
    toolChoice = options.toolChoice;
  }

  if (typeof options.toolChoice === "object" && "tool" in options.toolChoice) {
    toolChoice = {
      type: "function",
      function: { name: options.toolChoice.tool },
    };
  }

  return { tools, toolChoice };
});

// =============================================================================
// Utilities
// =============================================================================

const prepareResponseFormat = (
  options: LanguageModel.ProviderOptions,
): Record<string, unknown> | undefined => {
  if (options.responseFormat.type === "json") {
    const name = options.responseFormat.objectName;
    const schema = options.responseFormat.schema;
    return {
      type: "json_schema",
      json_schema: {
        name,
        description:
          Tool.getDescriptionFromSchemaAst(schema.ast) ??
          "Response with a JSON object",
        schema: Tool.getJsonSchemaFromSchemaAst(schema.ast),
        strict: true,
      },
    };
  }
  return undefined;
};
