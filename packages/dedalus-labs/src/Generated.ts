/**
 * @since 1.0.0
 */
import type * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientError from "@effect/platform/HttpClientError";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import { AiError } from "@src/ariadne";
import * as Effect from "effect/Effect";
import type { ParseError } from "effect/ParseResult";
import * as S from "effect/Schema";

/**
 * Model identifier string (e.g., 'openai/gpt-5', 'anthropic/claude-3-5-sonnet').
 */
export class ModelId extends S.String {}

export class ToolChoiceEnum extends S.Literal("auto", "required", "none") {}

export class MCPToolChoice extends S.Class<MCPToolChoice>("MCPToolChoice")({
  server_label: S.String,
  name: S.String,
}) {}

export class ToolChoice extends S.Union(
  ToolChoiceEnum,
  S.String,
  S.Record({ key: S.String, value: S.Unknown }),
  MCPToolChoice,
  S.Null,
) {}

export class ModelSettingsTruncationEnum extends S.Literal(
  "auto",
  "disabled",
) {}

export class ReasoningEffortEnum extends S.Literal(
  "minimal",
  "low",
  "medium",
  "high",
) {}

export class ReasoningGenerateSummaryEnum extends S.Literal(
  "auto",
  "concise",
  "detailed",
) {}

export class ReasoningSummaryEnum extends S.Literal(
  "auto",
  "concise",
  "detailed",
) {}

export class Reasoning extends S.Class<Reasoning>("Reasoning")({
  effort: S.optionalWith(ReasoningEffortEnum, { nullable: true }),
  generate_summary: S.optionalWith(ReasoningGenerateSummaryEnum, {
    nullable: true,
  }),
  summary: S.optionalWith(ReasoningSummaryEnum, { nullable: true }),
}) {}

export class QueryParams extends S.Record({
  key: S.String,
  value: S.Unknown,
}) {}

export class HeaderParams extends S.Record({
  key: S.String,
  value: S.Unknown,
}) {}

export class ModelSettings extends S.Class<ModelSettings>("ModelSettings")({
  temperature: S.optionalWith(S.Number, { nullable: true }),
  top_p: S.optionalWith(S.Number, { nullable: true }),
  frequency_penalty: S.optionalWith(S.Number, { nullable: true }),
  presence_penalty: S.optionalWith(S.Number, { nullable: true }),
  stop: S.optionalWith(S.Union(S.String, S.Array(S.String)), {
    nullable: true,
  }),
  seed: S.optionalWith(S.Int, { nullable: true }),
  logit_bias: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  logprobs: S.optionalWith(S.Boolean, { nullable: true }),
  top_logprobs: S.optionalWith(S.Int, { nullable: true }),
  n: S.optionalWith(S.Int, { nullable: true }),
  user: S.optionalWith(S.String, { nullable: true }),
  response_format: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  stream: S.optionalWith(S.Boolean, { nullable: true }),
  stream_options: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  audio: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  service_tier: S.optionalWith(S.String, { nullable: true }),
  prediction: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  tool_choice: S.optionalWith(ToolChoice, { nullable: true }),
  parallel_tool_calls: S.optionalWith(S.Boolean, { nullable: true }),
  truncation: S.optionalWith(ModelSettingsTruncationEnum, { nullable: true }),
  max_tokens: S.optionalWith(S.Int, { nullable: true }),
  max_completion_tokens: S.optionalWith(S.Int, { nullable: true }),
  reasoning: S.optionalWith(Reasoning, { nullable: true }),
  reasoning_effort: S.optionalWith(S.String, { nullable: true }),
  metadata: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  store: S.optionalWith(S.Boolean, { nullable: true }),
  include_usage: S.optionalWith(S.Boolean, { nullable: true }),
  timeout: S.optionalWith(S.Number, { nullable: true }),
  prompt_cache_key: S.optionalWith(S.String, { nullable: true }),
  safety_identifier: S.optionalWith(S.String, { nullable: true }),
  verbosity: S.optionalWith(S.String, { nullable: true }),
  web_search_options: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  response_include: S.optionalWith(
    S.Array(
      S.Literal(
        "code_interpreter_call.outputs",
        "computer_call_output.output.image_url",
        "file_search_call.results",
        "message.input_image.image_url",
        "message.output_text.logprobs",
        "reasoning.encrypted_content",
      ),
    ),
    { nullable: true },
  ),
  use_responses: S.optionalWith(S.Boolean, {
    nullable: true,
    default: () => false as const,
  }),
  extra_query: S.optionalWith(QueryParams, { nullable: true }),
  extra_headers: S.optionalWith(HeaderParams, { nullable: true }),
  extra_args: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  attributes: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  voice: S.optionalWith(S.String, { nullable: true }),
  modalities: S.optionalWith(S.Array(S.String), { nullable: true }),
  input_audio_format: S.optionalWith(S.String, { nullable: true }),
  output_audio_format: S.optionalWith(S.String, { nullable: true }),
  input_audio_transcription: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  turn_detection: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  thinking: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  top_k: S.optionalWith(S.Int, { nullable: true }),
  generation_config: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  system_instruction: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  safety_settings: S.optionalWith(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  tool_config: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  disable_automatic_function_calling: S.optionalWith(S.Boolean, {
    nullable: true,
    default: () => true as const,
  }),
  search_parameters: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  deferred: S.optionalWith(S.Boolean, { nullable: true }),
}) {}

/**
 * Structured model selection entry used in request payloads.
 *
 * Supports OpenAI-style semantics (string model id) while enabling
 * optional per-model default settings for Dedalus multi-model routing.
 */
export class DedalusModel extends S.Class<DedalusModel>("DedalusModel")({
  /**
   * Model identifier with provider prefix (e.g., 'openai/gpt-5', 'anthropic/claude-3-5-sonnet').
   */
  model: S.String,
  /**
   * Optional default generation settings (e.g., temperature, max_tokens) applied when this model is selected.
   */
  settings: S.optionalWith(ModelSettings, { nullable: true }),
}) {}

/**
 * Dedalus model choice - either a string ID or DedalusModel configuration object.
 */
export class DedalusModelChoice extends S.Union(ModelId, DedalusModel) {}

/**
 * List of models for multi-model routing.
 */
export class Models extends S.Array(DedalusModelChoice) {}

/**
 * Fields:
 * - type (required): Literal['disabled']
 */
export class ThinkingConfigDisabled extends S.Class<ThinkingConfigDisabled>(
  "ThinkingConfigDisabled",
)({
  type: S.Literal("disabled"),
}) {}

/**
 * Fields:
 * - budget_tokens (required): int
 * - type (required): Literal['enabled']
 */
export class ThinkingConfigEnabled extends S.Class<ThinkingConfigEnabled>(
  "ThinkingConfigEnabled",
)({
  /**
   * Determines how many tokens Claude can use for its internal reasoning process. Larger budgets can enable more thorough analysis for complex problems, improving response quality.
   *
   * Must be ≥1024 and less than `max_tokens`.
   *
   * See [extended thinking](https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking) for details.
   */
  budget_tokens: S.Int.pipe(S.greaterThanOrEqualTo(1024)),
  type: S.Literal("enabled"),
}) {}

export class ChatCompletionRequestReasoningEffortEnum extends S.Literal(
  "low",
  "medium",
  "high",
) {}

export class ChatCompletionRequestServiceTierEnum extends S.Literal(
  "auto",
  "default",
) {}

export class ChatCompletionRequestVerbosityEnum extends S.Literal(
  "low",
  "medium",
  "high",
) {}

/**
 * Chat completion request (OpenAI-compatible).
 *
 * Stateless chat completion endpoint. For stateful conversations with threads,
 * use the Responses API instead.
 */
export class ChatCompletionRequest extends S.Class<ChatCompletionRequest>(
  "ChatCompletionRequest",
)({
  /**
   * Model ID or list of model IDs for multi-model routing.
   */
  model: S.Union(DedalusModelChoice, Models),
  /**
   * Conversation history. Accepts either a list of message objects or a string, which is treated as a single user message.
   */
  messages: S.Union(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    S.String,
  ),
  /**
   * Convenience alias for Responses-style `input`. Used when `messages` is omitted to provide the user prompt directly.
   */
  input: S.optionalWith(
    S.Union(S.Array(S.Record({ key: S.String, value: S.Unknown })), S.String),
    { nullable: true },
  ),
  /**
   * What sampling temperature to use, between 0 and 2. Higher values like 0.8 make the output more random, while lower values like 0.2 make it more focused and deterministic. We generally recommend altering this or 'top_p' but not both.
   */
  temperature: S.optionalWith(
    S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(2)),
    { nullable: true },
  ),
  /**
   * An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered. We generally recommend altering this or 'temperature' but not both.
   */
  top_p: S.optionalWith(
    S.Number.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(1)),
    { nullable: true },
  ),
  /**
   * The maximum number of tokens that can be generated in the chat completion. This value can be used to control costs for text generated via API. This value is now deprecated in favor of 'max_completion_tokens' and is not compatible with o-series models.
   */
  max_tokens: S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(1)), {
    nullable: true,
  }),
  /**
   * Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
   */
  presence_penalty: S.optionalWith(
    S.Number.pipe(S.greaterThanOrEqualTo(-2), S.lessThanOrEqualTo(2)),
    { nullable: true },
  ),
  /**
   * Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
   */
  frequency_penalty: S.optionalWith(
    S.Number.pipe(S.greaterThanOrEqualTo(-2), S.lessThanOrEqualTo(2)),
    { nullable: true },
  ),
  /**
   * Modify the likelihood of specified tokens appearing in the completion. Accepts a JSON object mapping token IDs (as strings) to bias values from -100 to 100. The bias is added to the logits before sampling; values between -1 and 1 nudge selection probability, while values like -100 or 100 effectively ban or require a token.
   */
  logit_bias: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  /**
   * Not supported with latest reasoning models 'o3' and 'o4-mini'.
   *
   *         Up to 4 sequences where the API will stop generating further tokens; the returned text will not contain the stop sequence.
   */
  stop: S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * Extended thinking configuration (Anthropic only). Set type to 'enabled' or 'disabled'. When enabled, shows reasoning process in thinking blocks. Requires min 1,024 token budget.
   */
  thinking: S.optionalWith(
    S.Union(ThinkingConfigDisabled, ThinkingConfigEnabled),
    { nullable: true },
  ),
  /**
   * Top-k sampling. Anthropic: pass-through. Google: injected into generationConfig.topK.
   */
  top_k: S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(0)), {
    nullable: true,
  }),
  /**
   * System prompt/instructions. Anthropic: pass-through. Google: converted to systemInstruction. OpenAI: extracted from messages.
   */
  system: S.optionalWith(
    S.Union(S.String, S.Array(S.Record({ key: S.String, value: S.Unknown }))),
    { nullable: true },
  ),
  /**
   * Convenience alias for Responses-style `instructions`. Takes precedence over `system` and over system-role messages when provided.
   */
  instructions: S.optionalWith(
    S.Union(S.String, S.Array(S.Record({ key: S.String, value: S.Unknown }))),
    { nullable: true },
  ),
  /**
   * Google generationConfig object. Merged with auto-generated config. Use for Google-specific params (candidateCount, responseMimeType, etc.).
   */
  generation_config: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * Google safety settings (harm categories and thresholds).
   */
  safety_settings: S.optionalWith(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Google tool configuration (function calling mode, etc.).
   */
  tool_config: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  /**
   * Google-only flag to disable the SDK's automatic function execution. When true, the model returns function calls for the client to execute manually.
   */
  disable_automatic_function_calling: S.optionalWith(S.Boolean, {
    nullable: true,
  }),
  /**
   * If specified, system will make a best effort to sample deterministically. Determinism is not guaranteed for the same seed across different models or API versions.
   */
  seed: S.optionalWith(S.Int, { nullable: true }),
  /**
   * Stable identifier for your end-users. Helps OpenAI detect and prevent abuse and may boost cache hit rates. This field is being replaced by 'safety_identifier' and 'prompt_cache_key'.
   */
  user: S.optionalWith(S.String, { nullable: true }),
  /**
   * How many chat completion choices to generate for each input message. Keep 'n' as 1 to minimize costs.
   */
  n: S.optionalWith(
    S.Int.pipe(S.greaterThanOrEqualTo(1), S.lessThanOrEqualTo(128)),
    { nullable: true },
  ),
  /**
   * If true, the model response data is streamed to the client as it is generated using Server-Sent Events.
   */
  stream: S.optionalWith(S.Boolean, {
    nullable: true,
    default: () => false as const,
  }),
  /**
   * Options for streaming responses. Only set when 'stream' is true (supports 'include_usage' and 'include_obfuscation').
   */
  stream_options: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * An object specifying the format that the model must output. Use {'type': 'json_schema', 'json_schema': {...}} for structured outputs or {'type': 'json_object'} for the legacy JSON mode. Currently only OpenAI-prefixed models honour this field; Anthropic and Google requests will return an invalid_request_error if it is supplied.
   */
  response_format: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * A list of tools the model may call. Supports OpenAI function tools and custom tools; use 'mcp_servers' for Dedalus-managed server-side tools.
   */
  tools: S.optionalWith(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Controls which (if any) tool is called by the model. 'none' stops tool calling, 'auto' lets the model decide, and 'required' forces at least one tool invocation. Specific tool payloads force that tool.
   */
  tool_choice: S.optionalWith(
    S.Union(S.String, S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Whether to enable parallel function calling during tool use.
   */
  parallel_tool_calls: S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Deprecated in favor of 'tools'. Legacy list of function definitions the model may generate JSON inputs for.
   */
  functions: S.optionalWith(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Deprecated in favor of 'tool_choice'. Controls which function is called by the model (none, auto, or specific name).
   */
  function_call: S.optionalWith(
    S.Union(S.String, S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Whether to return log probabilities of the output tokens. If true, returns the log probabilities for each token in the response content.
   */
  logprobs: S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * An integer between 0 and 20 specifying how many of the most likely tokens to return at each position, with log probabilities. Requires 'logprobs' to be true.
   */
  top_logprobs: S.optionalWith(
    S.Int.pipe(S.greaterThanOrEqualTo(0), S.lessThanOrEqualTo(20)),
    { nullable: true },
  ),
  /**
   * An upper bound for the number of tokens that can be generated for a completion, including visible output and reasoning tokens.
   */
  max_completion_tokens: S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(1)), {
    nullable: true,
  }),
  /**
   * Constrains effort on reasoning for supported reasoning models. Higher values use more compute, potentially improving reasoning quality at the cost of latency and tokens.
   */
  reasoning_effort: S.optionalWith(ChatCompletionRequestReasoningEffortEnum, {
    nullable: true,
  }),
  /**
   * Parameters for audio output. Required when requesting audio responses (for example, modalities including 'audio').
   */
  audio: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  /**
   * Output types you would like the model to generate. Most models default to ['text']; some support ['text', 'audio'].
   */
  modalities: S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * Configuration for predicted outputs. Improves response times when you already know large portions of the response content.
   */
  prediction: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  /**
   * Set of up to 16 key-value string pairs that can be attached to the request for structured metadata.
   */
  metadata: S.optionalWith(S.Record({ key: S.String, value: S.Unknown }), {
    nullable: true,
  }),
  /**
   * Whether to store the output of this chat completion request for OpenAI model distillation or eval products. Image inputs over 8MB are dropped if storage is enabled.
   */
  store: S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * Specifies the processing tier used for the request. 'auto' uses project defaults, while 'default' forces standard pricing and performance.
   */
  service_tier: S.optionalWith(ChatCompletionRequestServiceTierEnum, {
    nullable: true,
  }),
  /**
   * Used by OpenAI to cache responses for similar requests and optimize cache hit rates. Replaces the legacy 'user' field for caching.
   */
  prompt_cache_key: S.optionalWith(S.String, { nullable: true }),
  /**
   * Stable identifier used to help detect users who might violate OpenAI usage policies. Consider hashing end-user identifiers before sending.
   */
  safety_identifier: S.optionalWith(S.String, { nullable: true }),
  /**
   * Constrains the verbosity of the model's response. Lower values produce concise answers, higher values allow more detail.
   */
  verbosity: S.optionalWith(ChatCompletionRequestVerbosityEnum, {
    nullable: true,
  }),
  /**
   * Configuration for OpenAI's web search tool. Learn more at https://platform.openai.com/docs/guides/tools-web-search?api-mode=chat.
   */
  web_search_options: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * xAI-specific parameter for configuring web search data acquisition. If not set, no data will be acquired by the model.
   */
  search_parameters: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * xAI-specific parameter. If set to true, the request returns a request_id for async completion retrieval via GET /v1/chat/deferred-completion/{request_id}.
   */
  deferred: S.optionalWith(S.Boolean, { nullable: true }),
  /**
   * MCP (Model Context Protocol) server addresses to make available for server-side tool execution. Entries can be URLs (e.g., 'https://mcp.example.com'), slugs (e.g., 'dedalus-labs/brave-search'), or structured objects specifying slug/version/url. MCP tools are executed server-side and billed separately.
   */
  mcp_servers: S.optionalWith(S.Union(S.String, S.Array(S.String)), {
    nullable: true,
  }),
  /**
   * Guardrails to apply to the agent for input/output validation and safety checks. Reserved for future use - guardrails configuration format not yet finalized.
   */
  guardrails: S.optionalWith(
    S.Array(S.Record({ key: S.String, value: S.Unknown })),
    { nullable: true },
  ),
  /**
   * Configuration for multi-model handoffs and agent orchestration. Reserved for future use - handoff configuration format not yet finalized.
   */
  handoff_config: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * Attributes for individual models used in routing decisions during multi-model execution. Format: {'model_name': {'attribute': value}}, where values are 0.0-1.0. Common attributes: 'intelligence', 'speed', 'cost', 'creativity', 'accuracy'. Used by agent to select optimal model based on task requirements.
   */
  model_attributes: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * Attributes for the agent itself, influencing behavior and model selection. Format: {'attribute': value}, where values are 0.0-1.0. Common attributes: 'complexity', 'accuracy', 'efficiency', 'creativity', 'friendliness'. Higher values indicate stronger preference for that characteristic.
   */
  agent_attributes: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
  /**
   * Maximum number of turns for agent execution before terminating (default: 10). Each turn represents one model inference cycle. Higher values allow more complex reasoning but increase cost and latency.
   */
  max_turns: S.optionalWith(
    S.Int.pipe(S.greaterThanOrEqualTo(1), S.lessThanOrEqualTo(100)),
    { nullable: true },
  ),
  /**
   * When False, skip server-side tool execution and return raw OpenAI-style tool_calls in the response.
   */
  auto_execute_tools: S.optionalWith(S.Boolean, {
    nullable: true,
    default: () => true as const,
  }),
}) {}

export class ChoiceFinishReasonEnum extends S.Literal(
  "stop",
  "length",
  "tool_calls",
  "content_filter",
  "function_call",
) {}

/**
 * The function that the model called.
 *
 * Fields:
 *   - name (required): str
 *   - arguments (required): str
 */
export class Function extends S.Class<Function>("Function")({
  /**
   * The name of the function to call.
   */
  name: S.String,
  /**
   * The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.
   */
  arguments: S.String,
}) {}

/**
 * A call to a function tool created by the model.
 *
 * Fields:
 *   - id (required): str
 *   - type (required): Literal['function']
 *   - function (required): Function
 */
export class ChatCompletionMessageToolCall extends S.Class<ChatCompletionMessageToolCall>(
  "ChatCompletionMessageToolCall",
)({
  /**
   * The ID of the tool call.
   */
  id: S.String,
  /**
   * The type of the tool. Currently, only `function` is supported.
   */
  type: S.Literal("function"),
  /**
   * The function that the model called.
   */
  function: Function,
}) {}

/**
 * The custom tool that the model called.
 *
 * Fields:
 *   - name (required): str
 *   - input (required): str
 */
export class Custom extends S.Class<Custom>("Custom")({
  /**
   * The name of the custom tool to call.
   */
  name: S.String,
  /**
   * The input for the custom tool call generated by the model.
   */
  input: S.String,
}) {}

/**
 * A call to a custom tool created by the model.
 *
 * Fields:
 *   - id (required): str
 *   - type (required): Literal['custom']
 *   - custom (required): Custom
 */
export class ChatCompletionMessageCustomToolCall extends S.Class<ChatCompletionMessageCustomToolCall>(
  "ChatCompletionMessageCustomToolCall",
)({
  /**
   * The ID of the tool call.
   */
  id: S.String,
  /**
   * The type of the tool. Always `custom`.
   */
  type: S.Literal("custom"),
  /**
   * The custom tool that the model called.
   */
  custom: Custom,
}) {}

/**
 * A URL citation when using web search.
 *
 * Fields:
 *   - end_index (required): int
 *   - start_index (required): int
 *   - url (required): str
 *   - title (required): str
 */
export class UrlCitation extends S.Class<UrlCitation>("UrlCitation")({
  /**
   * The index of the last character of the URL citation in the message.
   */
  end_index: S.Int,
  /**
   * The index of the first character of the URL citation in the message.
   */
  start_index: S.Int,
  /**
   * The URL of the web resource.
   */
  url: S.String,
  /**
   * The title of the web resource.
   */
  title: S.String,
}) {}

/**
 * A URL citation when using web search.
 *
 * Fields:
 *   - type (required): Literal['url_citation']
 *   - url_citation (required): UrlCitation
 */
export class AnnotationsItem extends S.Class<AnnotationsItem>(
  "AnnotationsItem",
)({
  /**
   * The type of the URL citation. Always `url_citation`.
   */
  type: S.Literal("url_citation"),
  /**
   * A URL citation when using web search.
   */
  url_citation: UrlCitation,
}) {}

/**
 * Deprecated and replaced by `tool_calls`. The name and arguments of a function that should be called, as generated by the model.
 *
 * Fields:
 *   - arguments (required): str
 *   - name (required): str
 */
export class FunctionCall extends S.Class<FunctionCall>("FunctionCall")({
  /**
   * The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.
   */
  arguments: S.String,
  /**
   * The name of the function to call.
   */
  name: S.String,
}) {}

/**
 * If the audio output modality is requested, this object contains data
 *
 * about the audio response from the model. [Learn more](https://platform.openai.com/docs/guides/audio).
 *
 * Fields:
 *   - id (required): str
 *   - expires_at (required): int
 *   - data (required): str
 *   - transcript (required): str
 */
export class Audio extends S.Class<Audio>("Audio")({
  /**
   * Unique identifier for this audio response.
   */
  id: S.String,
  /**
   * The Unix timestamp (in seconds) for when this audio response will
   * no longer be accessible on the server for use in multi-turn
   * conversations.
   */
  expires_at: S.Int,
  /**
   * Base64 encoded audio bytes generated by the model, in the format
   * specified in the request.
   */
  data: S.String,
  /**
   * Transcript of the audio generated by the model.
   */
  transcript: S.String,
}) {}

/**
 * A chat completion message generated by the model.
 *
 * Fields:
 *   - content (required): str | None
 *   - refusal (required): str | None
 *   - tool_calls (optional): ChatCompletionMessageToolCalls
 *   - annotations (optional): list[AnnotationsItem]
 *   - role (required): Literal['assistant']
 *   - function_call (optional): FunctionCall
 *   - audio (optional): Audio | None
 */
export class ChatCompletionResponseMessage extends S.Class<ChatCompletionResponseMessage>(
  "ChatCompletionResponseMessage",
)({
  /**
   * The contents of the message.
   */
  content: S.NullOr(S.String),
  /**
   * The refusal message generated by the model.
   */
  refusal: S.optionalWith(S.NullOr(S.String), { nullable: true }),
  /**
   * The tool calls generated by the model, such as function calls.
   */
  tool_calls: S.optionalWith(
    S.Array(
      S.Union(
        ChatCompletionMessageToolCall,
        ChatCompletionMessageCustomToolCall,
      ),
    ),
    { nullable: true },
  ),
  /**
   * Annotations for the message, when applicable, as when using the
   * [web search tool](https://platform.openai.com/docs/guides/tools-web-search?api-mode=chat).
   */
  annotations: S.optionalWith(S.Array(AnnotationsItem), { nullable: true }),
  /**
   * The role of the author of this message.
   */
  role: S.Literal("assistant"),
  /**
   * Deprecated and replaced by `tool_calls`. The name and arguments of a function that should be called, as generated by the model.
   */
  function_call: S.optionalWith(FunctionCall, { nullable: true }),
  /**
   * If the audio output modality is requested, this object contains data
   * about the audio response from the model. [Learn more](https://platform.openai.com/docs/guides/audio).
   */
  audio: S.optionalWith(Audio, { nullable: true }),
}) {}

/**
 * Token and its log probability.
 */
export class TopLogprob extends S.Class<TopLogprob>("TopLogprob")({
  /**
   * The token.
   */
  token: S.String,
  /**
   * The log probability of this token, if it is within the top 20 most likely tokens. Otherwise, the value `-9999.0` is used to signify that the token is very unlikely.
   */
  logprob: S.Number,
  /**
   * A list of integers representing the UTF-8 bytes representation of the token. Useful in instances where characters are represented by multiple tokens and their byte representations must be combined to generate the correct text representation. Can be `null` if there is no bytes representation for the token.
   */
  bytes: S.NullOr(S.Array(S.Int)),
}) {}

/**
 * Token log probability information.
 */
export class ChatCompletionTokenLogprob extends S.Class<ChatCompletionTokenLogprob>(
  "ChatCompletionTokenLogprob",
)({
  /**
   * The token.
   */
  token: S.String,
  /**
   * The log probability of this token, if it is within the top 20 most likely tokens. Otherwise, the value `-9999.0` is used to signify that the token is very unlikely.
   */
  logprob: S.Number,
  /**
   * A list of integers representing the UTF-8 bytes representation of the token. Useful in instances where characters are represented by multiple tokens and their byte representations must be combined to generate the correct text representation. Can be `null` if there is no bytes representation for the token.
   */
  bytes: S.NullOr(S.Array(S.Int)),
  /**
   * List of the most likely tokens and their log probability, at this token position. In rare cases, there may be fewer than the number of requested `top_logprobs` returned.
   */
  top_logprobs: S.Array(TopLogprob),
}) {}

/**
 * Log probability information for the choice.
 */
export class ChoiceLogprobs extends S.Class<ChoiceLogprobs>("ChoiceLogprobs")({
  /**
   * A list of message content tokens with log probability information.
   */
  content: S.optionalWith(S.Array(ChatCompletionTokenLogprob), {
    nullable: true,
  }),
  /**
   * A list of message refusal tokens with log probability information.
   */
  refusal: S.optionalWith(S.Array(ChatCompletionTokenLogprob), {
    nullable: true,
  }),
}) {}

/**
 * A chat completion choice.
 *
 * OpenAI-compatible choice object for non-streaming responses.
 * Part of the ChatCompletion response.
 */
export class Choice extends S.Class<Choice>("Choice")({
  /**
   * The reason the model stopped generating tokens. This will be `stop` if the model hit a natural stop point or a provided stop sequence,
   * `length` if the maximum number of tokens specified in the request was reached,
   * `content_filter` if content was omitted due to a flag from our content filters,
   * `tool_calls` if the model called a tool, or `function_call` (deprecated) if the model called a function.
   */
  finish_reason: S.optionalWith(ChoiceFinishReasonEnum, { nullable: true }),
  /**
   * The index of the choice in the list of choices.
   */
  index: S.Int,
  /**
   * A chat completion message generated by the model.
   */
  message: ChatCompletionResponseMessage,
  /**
   * Log probability information for the choice.
   */
  logprobs: S.optionalWith(ChoiceLogprobs, { nullable: true }),
}) {}

export class ChatCompletionServiceTierEnum extends S.Literal(
  "auto",
  "default",
  "flex",
  "scale",
  "priority",
) {}

/**
 * Breakdown of tokens used in a completion.
 *
 * Fields:
 *   - accepted_prediction_tokens (optional): int
 *   - audio_tokens (optional): int
 *   - reasoning_tokens (optional): int
 *   - rejected_prediction_tokens (optional): int
 */
export class CompletionTokensDetails extends S.Class<CompletionTokensDetails>(
  "CompletionTokensDetails",
)({
  /**
   * When using Predicted Outputs, the number of tokens in the
   * prediction that appeared in the completion.
   */
  accepted_prediction_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
  /**
   * Audio input tokens generated by the model.
   */
  audio_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
  /**
   * Tokens generated by the model for reasoning.
   */
  reasoning_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
  /**
   * When using Predicted Outputs, the number of tokens in the
   * prediction that did not appear in the completion. However, like
   * reasoning tokens, these tokens are still counted in the total
   * completion tokens for purposes of billing, output, and context window
   * limits.
   */
  rejected_prediction_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
}) {}

/**
 * Breakdown of tokens used in the prompt.
 *
 * Fields:
 *   - audio_tokens (optional): int
 *   - cached_tokens (optional): int
 */
export class PromptTokensDetails extends S.Class<PromptTokensDetails>(
  "PromptTokensDetails",
)({
  /**
   * Audio input tokens present in the prompt.
   */
  audio_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
  /**
   * Cached tokens present in the prompt.
   */
  cached_tokens: S.optionalWith(S.Int, {
    nullable: true,
    default: () => 0 as const,
  }),
}) {}

/**
 * Usage statistics for the completion request.
 *
 * Fields:
 *   - completion_tokens (required): int
 *   - prompt_tokens (required): int
 *   - total_tokens (required): int
 *   - completion_tokens_details (optional): CompletionTokensDetails
 *   - prompt_tokens_details (optional): PromptTokensDetails
 */
export class CompletionUsage extends S.Class<CompletionUsage>(
  "CompletionUsage",
)({
  /**
   * Number of tokens in the generated completion.
   */
  completion_tokens: S.Int,
  /**
   * Number of tokens in the prompt.
   */
  prompt_tokens: S.Int,
  /**
   * Total number of tokens used in the request (prompt + completion).
   */
  total_tokens: S.Int,
  /**
   * Breakdown of tokens used in a completion.
   */
  completion_tokens_details: S.optionalWith(CompletionTokensDetails, {
    nullable: true,
  }),
  /**
   * Breakdown of tokens used in the prompt.
   */
  prompt_tokens_details: S.optionalWith(PromptTokensDetails, {
    nullable: true,
  }),
}) {}

/**
 * Chat completion response for Dedalus API.
 *
 * OpenAI-compatible chat completion response with Dedalus extensions.
 * Maintains full compatibility with OpenAI API while providing additional
 * features like server-side tool execution tracking and MCP error reporting.
 */
export class ChatCompletion extends S.Class<ChatCompletion>("ChatCompletion")({
  /**
   * A unique identifier for the chat completion.
   */
  id: S.String,
  /**
   * A list of chat completion choices. Can be more than one if `n` is greater than 1.
   */
  choices: S.Array(Choice),
  /**
   * The Unix timestamp (in seconds) of when the chat completion was created.
   */
  created: S.Int,
  /**
   * The model used for the chat completion.
   */
  model: S.String,
  /**
   * Specifies the processing type used for serving the request.
   *   - If set to 'auto', then the request will be processed with the service tier configured in the Project settings. Unless otherwise configured, the Project will use 'default'.
   *   - If set to 'default', then the request will be processed with the standard pricing and performance for the selected model.
   *   - If set to '[flex](https://platform.openai.com/docs/guides/flex-processing)' or '[priority](https://openai.com/api-priority-processing/)', then the request will be processed with the corresponding service tier.
   *   - When not set, the default behavior is 'auto'.
   *
   *   When the `service_tier` parameter is set, the response body will include the `service_tier` value based on the processing mode actually used to serve the request. This response value may be different from the value set in the parameter.
   */
  service_tier: S.optionalWith(ChatCompletionServiceTierEnum, {
    nullable: true,
  }),
  /**
   * This fingerprint represents the backend configuration that the model runs with.
   *
   * Can be used in conjunction with the `seed` request parameter to understand when backend changes have been made that might impact determinism.
   */
  system_fingerprint: S.optionalWith(S.String, { nullable: true }),
  /**
   * The object type, which is always `chat.completion`.
   */
  object: S.Literal("chat.completion"),
  /**
   * Usage statistics for the completion request.
   */
  usage: S.optionalWith(CompletionUsage, { nullable: true }),
  /**
   * List of tool names that were executed server-side (e.g., MCP tools). Only present when tools were executed on the server rather than returned for client-side execution.
   */
  tools_executed: S.optionalWith(S.Array(S.String), { nullable: true }),
  /**
   * Information about MCP server failures, if any occurred during the request. Contains details about which servers failed and why, along with recommendations for the user. Only present when MCP server failures occurred.
   */
  mcp_server_errors: S.optionalWith(
    S.Record({ key: S.String, value: S.Unknown }),
    { nullable: true },
  ),
}) {}

export class ValidationError extends S.Class<ValidationError>(
  "ValidationError",
)({
  loc: S.Array(S.Union(S.String, S.Int)),
  msg: S.String,
  type: S.String,
}) {}

export class HTTPValidationError extends S.Class<HTTPValidationError>(
  "HTTPValidationError",
)({
  detail: S.optionalWith(S.Array(ValidationError), { nullable: true }),
}) {}

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?:
      | ((
          client: HttpClient.HttpClient,
        ) => Effect.Effect<HttpClient.HttpClient>)
      | undefined;
  } = {},
): Client => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.ResponseError({
            request: response.request,
            response,
            reason: "StatusCode",
            description:
              typeof description === "string"
                ? description
                : JSON.stringify(description),
          }),
        ),
    );
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>,
  ) => (
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
        Effect.flatMap(
          Effect.flatMap(options.transformClient!(httpClient), (client) =>
            client.execute(request),
          ),
          f,
        )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f);
  const decodeSuccess =
    <A, I, R>(schema: S.Schema<A, I, R>) =>
    (response: HttpClientResponse.HttpClientResponse) =>
      HttpClientResponse.schemaBodyJson(schema)(response);
  const decodeValidationError =
    (response: HttpClientResponse.HttpClientResponse) =>
      Effect.flatMap(
        HttpClientResponse.schemaBodyJson(HTTPValidationError)(response),
        (cause) =>
          Effect.fail(
            new AiError.MalformedInput({
              module: "DedalusClient",
              method: response.request.url,
              description: cause.detail
                ?.map((v) => `${v.loc.join(".")}: ${v.msg}`)
                .join("; "),
            }),
          ),
      );
  return {
    httpClient,
    createChatCompletionV1ChatCompletionsPost: (options) =>
      HttpClientRequest.post(`/v1/chat/completions`).pipe(
        HttpClientRequest.bodyUnsafeJson(options),
        withResponse(
          HttpClientResponse.matchStatus({
            "2xx": decodeSuccess(ChatCompletion),
            "422": decodeValidationError,
            orElse: unexpectedStatus,
          }),
        ),
      ),
    createEmbeddingsV1EmbeddingsPost: (options) =>
      HttpClientRequest.post(`/v1/embeddings`).pipe(
        HttpClientRequest.bodyUnsafeJson(options),
        withResponse(
          HttpClientResponse.matchStatus({
            "2xx": decodeSuccess(CreateEmbeddingResponse),
            "422": decodeValidationError,
            orElse: unexpectedStatus,
          }),
        ),
      ),
  };
};

export interface Client {
  readonly httpClient: HttpClient.HttpClient;
  /**
   * Generate a model response. Supports streaming, tools, and MCP servers.
   */
  readonly createChatCompletionV1ChatCompletionsPost: (
    options: typeof ChatCompletionRequest.Encoded,
  ) => Effect.Effect<
    typeof ChatCompletion.Type,
    HttpClientError.HttpClientError | ParseError | AiError.MalformedInput
  >;
  /**
   * Create embeddings using the configured provider.
   */
  readonly createEmbeddingsV1EmbeddingsPost: (
    options: typeof CreateEmbeddingRequest.Encoded,
  ) => Effect.Effect<
    typeof CreateEmbeddingResponse.Type,
    HttpClientError.HttpClientError | ParseError | AiError.MalformedInput
  >;
}

export class CreateEmbeddingRequestModelEnum extends S.Literal(
  "openai/text-embedding-ada-002",
  "openai/text-embedding-3-small",
  "openai/text-embedding-3-large",
  "google/text-embedding-004",
) {}

/**
 * The format to return the embeddings in. Can be either `float` or [`base64`](https://pypi.org/project/pybase64/).
 */
export class CreateEmbeddingRequestEncodingFormat extends S.Literal(
  "float",
  "base64",
) {}

/**
 * Fields:
 * - input (required): str | Annotated[list[str], MinLen(1), MaxLen(2048)] | Annotated[list[int], MinLen(1), MaxLen(2048)] | Annotated[list[Annotated[list[int], MinLen(1)]], MinLen(1), MaxLen(2048)]
 * - model (required): str | Literal['openai/text-embedding-ada-002', 'openai/text-embedding-3-small', 'openai/text-embedding-3-large', 'google/text-embedding-004']
 * - encoding_format (optional): Literal['float', 'base64']
 * - dimensions (optional): int
 * - user (optional): str
 */
export class CreateEmbeddingRequest extends S.Class<CreateEmbeddingRequest>(
  "CreateEmbeddingRequest",
)({
  /**
   * Input text to embed, encoded as a string or array of tokens. To embed multiple inputs in a single request, pass an array of strings or array of token arrays. The input must not exceed the max input tokens for the model (8192 tokens for all embedding models), cannot be an empty string, and any array must be 2048 dimensions or less. [Example Python code](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken) for counting tokens. In addition to the per-input token limit, all embedding  models enforce a maximum of 300,000 tokens summed across all inputs in a  single request.
   */
  input: S.Union(
    S.String,
    S.NonEmptyArray(S.String).pipe(S.minItems(1), S.maxItems(2048)),
    S.NonEmptyArray(S.Int).pipe(S.minItems(1), S.maxItems(2048)),
    S.NonEmptyArray(S.NonEmptyArray(S.Int).pipe(S.minItems(1))).pipe(
      S.minItems(1),
      S.maxItems(2048),
    ),
  ),
  /**
   * ID of the model to use. See our [Model Providers](/sdk/guides/providers) for available embedding models.
   */
  model: S.Union(S.String, CreateEmbeddingRequestModelEnum),
  /**
   * The format to return the embeddings in. Can be either `float` or [`base64`](https://pypi.org/project/pybase64/).
   */
  encoding_format: S.optionalWith(CreateEmbeddingRequestEncodingFormat, {
    nullable: true,
    default: () => "float" as const,
  }),
  /**
   * The number of dimensions the resulting output embeddings should have. Only supported in `text-embedding-3` and later models.
   */
  dimensions: S.optionalWith(S.Int.pipe(S.greaterThanOrEqualTo(1)), {
    nullable: true,
  }),
  /**
   * A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids).
   */
  user: S.optionalWith(S.String, { nullable: true }),
}) {}

/**
 * Single embedding object.
 */
export class Embedding extends S.Class<Embedding>("Embedding")({
  /**
   * Object type, always 'embedding'
   */
  object: S.optionalWith(S.Literal("embedding"), {
    nullable: true,
    default: () => "embedding" as const,
  }),
  /**
   * The embedding vector (float array or base64 string)
   */
  embedding: S.Union(S.Array(S.Number), S.String),
  /**
   * Index of the embedding in the list
   */
  index: S.Int,
}) {}

/**
 * Response from embeddings endpoint.
 */
export class CreateEmbeddingResponse extends S.Class<CreateEmbeddingResponse>(
  "CreateEmbeddingResponse",
)({
  /**
   * Object type, always 'list'
   */
  object: S.optionalWith(S.Literal("list"), {
    nullable: true,
    default: () => "list" as const,
  }),
  /**
   * List of embedding objects
   */
  data: S.Array(Embedding),
  /**
   * The model used for embeddings
   */
  model: S.String,
  /**
   * Usage statistics (prompt_tokens, total_tokens)
   */
  usage: S.Record({ key: S.String, value: S.Unknown }),
}) {}
