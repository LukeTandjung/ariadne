/**
 * The `AgentRunner` module provides agentic loop capabilities for AI language
 * models.
 *
 * This module enables multi-turn inference loops where the language model can
 * iteratively call tools and receive results until it produces a final answer.
 * It wraps the `LanguageModel` service to provide this functionality while
 * maintaining full compatibility with the existing API surface.
 *
 * @example
 * ```ts
 * import { AgentRunner, LanguageModel, Toolkit, Tool } from "ariadne"
 * import { Effect, Schema } from "effect"
 *
 * // Define tools
 * const SearchTool = Tool.make("search", {
 *   description: "Search the web",
 *   parameters: { query: Schema.String },
 *   success: Schema.String,
 * })
 *
 * const MyToolkit = Toolkit.make(SearchTool)
 *
 * // Use LanguageModel as usual
 * const program = LanguageModel.generateText({
 *   prompt: "Research the latest AI developments",
 *   toolkit: MyToolkit,
 * })
 *
 * // Add AgentRunner.ReAct to enable multi-turn loop
 * program.pipe(
 *   Effect.provide(MyToolkitLive),
 *   Effect.provide(AgentRunner.ReAct),
 *   Effect.provide(AgentRunner.defaultConfig),
 *   Effect.provide(Gpt4oMini),
 *   Effect.provide(Dedalus),
 *   Effect.runPromise
 * )
 * ```
 *
 * @since 1.0.0
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import type { NoExcessProperties } from "effect/Types";
import * as LanguageModel from "./LanguageModel.js";
import * as Prompt from "./Prompt.js";
import type * as Response from "./Response.js";
import type * as Tool from "./Tool.js";

// =============================================================================
// Configuration
// =============================================================================

/**
 * The `Config` service tag for AgentRunner configuration.
 *
 * This tag provides access to runner configuration like maximum turns
 * throughout your application.
 *
 * @example
 * ```ts
 * import { AgentRunner } from "ariadne"
 * import { Effect } from "effect"
 *
 * // Use default config
 * program.pipe(
 *   Effect.provide(AgentRunner.defaultConfig)
 * )
 *
 * // Or provide custom config
 * program.pipe(
 *   Effect.provide(Layer.succeed(AgentRunner.Config, { maxTurns: 20 }))
 * )
 * ```
 *
 * @since 1.0.0
 * @category Context
 */
export class Config extends Context.Tag("ariadne/AgentRunner/Config")<
    Config,
    Config.Service
>() {
    /**
     * Retrieves the config from context, or undefined if not present.
     *
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
     * Configuration options for the AgentRunner.
     *
     * @since 1.0.0
     * @category Models
     */
    export interface Service {
        /**
         * Maximum number of inference turns before stopping the loop.
         * Each turn represents one call to the language model.
         *
         * @default 10
         */
        readonly maxTurns?: number | undefined;
    }
}

/**
 * Default configuration layer for AgentRunner.
 *
 * Provides sensible defaults:
 * - `maxTurns`: 10
 *
 * @since 1.0.0
 * @category Layers
 */
export const defaultConfig: Layer.Layer<Config> = Layer.succeed(Config, {
    maxTurns: 10,
});

// =============================================================================
// ReAct Loop Implementation
// =============================================================================

/**
 * ReAct (Reason + Act) loop layer that wraps LanguageModel.
 *
 * When provided, this layer intercepts LanguageModel calls and runs them
 * in a loop until the model stops requesting tool calls. This enables
 * multi-turn agentic behavior where the model can iteratively:
 * 1. Analyze the current state
 * 2. Decide to call tools (local or MCP server-side)
 * 3. Receive tool results
 * 4. Continue reasoning until producing a final answer
 *
 * The loop terminates when:
 * - The model produces a response without tool calls (`finishReason === "stop"`)
 * - The model hits a token limit (`finishReason === "length"`)
 * - Content is filtered (`finishReason === "content-filter"`)
 * - Maximum turns is reached (configured via `Config`)
 *
 * MCP tools are handled automatically - they execute server-side and their
 * results are included in the response. The loop continues based on whether
 * there are additional local tool calls to process.
 *
 * @example
 * ```ts
 * import { AgentRunner, LanguageModel } from "ariadne"
 * import { Effect } from "effect"
 *
 * const program = LanguageModel.generateText({
 *   prompt: "Research and summarize AI trends",
 *   toolkit: MyToolkit,
 * })
 *
 * // Single-step (without AgentRunner)
 * program.pipe(
 *   Effect.provide(MyToolkitLive),
 *   Effect.provide(Gpt4oMini),
 *   Effect.provide(Dedalus),
 * )
 *
 * // Multi-step loop (with AgentRunner)
 * program.pipe(
 *   Effect.provide(MyToolkitLive),
 *   Effect.provide(AgentRunner.ReAct),
 *   Effect.provide(AgentRunner.defaultConfig),
 *   Effect.provide(Gpt4oMini),
 *   Effect.provide(Dedalus),
 * )
 * ```
 *
 * @since 1.0.0
 * @category Layers
 */
export const ReAct: Layer.Layer<
    LanguageModel.LanguageModel,
    never,
    LanguageModel.LanguageModel | Config
> = Layer.effect(
    LanguageModel.LanguageModel,
    Effect.gen(function* () {
        const underlying = yield* LanguageModel.LanguageModel;
        const config = yield* Config.getOrUndefined;
        const maxTurns = config?.maxTurns ?? 10;

        const shouldTerminate = (finishReason: Response.FinishReason): boolean =>
            finishReason === "stop" ||
            finishReason === "length" ||
            finishReason === "content-filter" ||
            finishReason === "error" ||
            finishReason === "unknown";

        // Filter out finish parts from intermediate turns to ensure the final
        // response's finishReason reflects the actual termination condition
        const excludeFinishParts = <Tools extends Record<string, Tool.Any>>(
            content: ReadonlyArray<Response.Part<Tools>>,
        ): Array<Response.Part<Tools>> =>
            content.filter(
                (p): p is Response.Part<Tools> => p.type !== "finish",
            );

        const generateText = <
            Options extends NoExcessProperties<
                LanguageModel.GenerateTextOptions<any>,
                Options
            >,
            Tools extends Record<string, Tool.Any> = {},
        >(
            options: Options & LanguageModel.GenerateTextOptions<Tools>,
        ): Effect.Effect<
            LanguageModel.GenerateTextResponse<Tools>,
            LanguageModel.ExtractError<Options>,
            LanguageModel.ExtractContext<Options>
        > =>
            Effect.gen(function* () {
                const history = yield* Ref.make(Prompt.make(options.prompt));
                let turns = 0;
                let allContent: Array<Response.Part<Tools>> = [];

                while (turns < maxTurns) {
                    turns++;

                    const currentPrompt = yield* Ref.get(history);
                    const response = yield* underlying.generateText({
                        ...options,
                        prompt: currentPrompt,
                    });

                    if (shouldTerminate(response.finishReason)) {
                        allContent = [...allContent, ...response.content];
                        return new LanguageModel.GenerateTextResponse(
                            allContent,
                        );
                    }

                    allContent = [
                        ...allContent,
                        ...excludeFinishParts(response.content),
                    ];

                    const newPrompt = Prompt.merge(
                        currentPrompt,
                        Prompt.fromResponseParts(response.content),
                    );
                    yield* Ref.set(history, newPrompt);
                }

                return new LanguageModel.GenerateTextResponse(allContent);
            });

        const generateObject = <
            A,
            I extends Record<string, unknown>,
            R,
            Options extends NoExcessProperties<
                LanguageModel.GenerateObjectOptions<any, A, I, R>,
                Options
            >,
            Tools extends Record<string, Tool.Any> = {},
        >(
            options: Options & LanguageModel.GenerateObjectOptions<Tools, A, I, R>,
        ): Effect.Effect<
            LanguageModel.GenerateObjectResponse<Tools, A>,
            LanguageModel.ExtractError<Options>,
            R | LanguageModel.ExtractContext<Options>
        > =>
            Effect.gen(function* () {
                const history = yield* Ref.make(Prompt.make(options.prompt));
                let turns = 0;
                let allContent: Array<Response.Part<Tools>> = [];
                let finalValue: A | undefined;

                while (turns < maxTurns) {
                    turns++;

                    const currentPrompt = yield* Ref.get(history);
                    const response = yield* underlying.generateObject({
                        ...options,
                        prompt: currentPrompt,
                    });

                    finalValue = response.value;

                    if (shouldTerminate(response.finishReason)) {
                        allContent = [...allContent, ...response.content];
                        return new LanguageModel.GenerateObjectResponse(
                            finalValue,
                            allContent,
                        );
                    }

                    allContent = [
                        ...allContent,
                        ...excludeFinishParts(response.content),
                    ];

                    const newPrompt = Prompt.merge(
                        currentPrompt,
                        Prompt.fromResponseParts(response.content),
                    );
                    yield* Ref.set(history, newPrompt);
                }

                return new LanguageModel.GenerateObjectResponse(
                    finalValue as A,
                    allContent,
                );
            });

        const streamText = <
            Options extends NoExcessProperties<
                LanguageModel.GenerateTextOptions<any>,
                Options
            >,
            Tools extends Record<string, Tool.Any> = {},
        >(
            options: Options & LanguageModel.GenerateTextOptions<Tools>,
        ): Stream.Stream<
            Response.StreamPart<Tools>,
            LanguageModel.ExtractError<Options>,
            LanguageModel.ExtractContext<Options>
        > => {
            const history = Ref.unsafeMake(Prompt.make(options.prompt));
            let turns = 0;

            const runTurn = (): Stream.Stream<
                Response.StreamPart<Tools>,
                LanguageModel.ExtractError<Options>,
                LanguageModel.ExtractContext<Options>
            > =>
                Stream.unwrap(
                    Effect.gen(function* () {
                        if (turns >= maxTurns) {
                            return Stream.empty;
                        }

                        turns++;
                        const currentPrompt = yield* Ref.get(history);

                        let accumulatedParts: Array<Response.StreamPart<Tools>> =
                            [];
                        let finishReason: Response.FinishReason = "unknown";

                        const innerStream = underlying
                            .streamText({
                                ...options,
                                prompt: currentPrompt,
                            })
                            .pipe(
                                Stream.tap((part) =>
                                    Effect.sync(() => {
                                        accumulatedParts.push(part);
                                        if (part.type === "finish") {
                                            finishReason = part.reason;
                                        }
                                    }),
                                ),
                            );

                        const continueOrEnd = Effect.gen(function* () {
                            if (!shouldTerminate(finishReason)) {
                                const currentPrompt = yield* Ref.get(history);
                                const newPrompt = Prompt.merge(
                                    currentPrompt,
                                    Prompt.fromResponseParts(accumulatedParts),
                                );
                                yield* Ref.set(history, newPrompt);
                                return runTurn();
                            }
                            return Stream.empty;
                        });

                        return Stream.concat(
                            innerStream,
                            Stream.unwrap(continueOrEnd),
                        );
                    }),
                );

            return runTurn();
        };

        const streamObject = <
            A,
            I extends Record<string, unknown>,
            R,
            Options extends NoExcessProperties<
                LanguageModel.GenerateObjectOptions<any, A, I, R>,
                Options
            >,
            Tools extends Record<string, Tool.Any> = {},
        >(
            options: Options & LanguageModel.GenerateObjectOptions<Tools, A, I, R>,
        ): Stream.Stream<
            Response.StreamObjectPart<A>,
            LanguageModel.ExtractError<Options>,
            R | LanguageModel.ExtractContext<Options>
        > =>
            // For streamObject, the loop behavior is less common since we're
            // extracting a structured object. Delegate to underlying without
            // looping - tool calls during object generation typically need
            // different handling than iterative refinement.
            underlying.streamObject(options);

        return {
            generateText,
            generateObject,
            streamText,
            streamObject,
        };
    }),
);
