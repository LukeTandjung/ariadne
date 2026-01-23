/**
 * @since 1.0.0
 */
import type { HttpClient } from "@effect/platform/HttpClient";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";

/**
 * @since 1.0.0
 * @category Context
 */
export class DedalusConfig extends Context.Tag(
  "@dedalus-labs/DedalusConfig",
)<DedalusConfig, DedalusConfig.Service>() {
  /**
   * @since 1.0.0
   */
  static readonly getOrUndefined: Effect.Effect<
    typeof DedalusConfig.Service | undefined
  > = Effect.map(Effect.context<never>(), (context) =>
    context.unsafeMap.get(DedalusConfig.key),
  );
}

/**
 * @since 1.0.0
 */
export declare namespace DedalusConfig {
  /**
   * @since 1.0.
   * @category Models
   */
  export interface Service {
    readonly transformClient?: (client: HttpClient) => HttpClient;
  }
}

/**
 * @since 1.0.0
 * @category Configuration
 */
export const withClientTransform: {
  (
    transform: (client: HttpClient) => HttpClient,
  ): <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    transform: (client: HttpClient) => HttpClient,
  ): Effect.Effect<A, E, R>;
} = dual<
  (
    transform: (client: HttpClient) => HttpClient,
  ) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>,
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
    transform: (client: HttpClient) => HttpClient,
  ) => Effect.Effect<A, E, R>
>(2, (self, transformClient) =>
  Effect.flatMap(DedalusConfig.getOrUndefined, (config) =>
    Effect.provideService(self, DedalusConfig, {
      ...config,
      transformClient,
    }),
  ),
);
