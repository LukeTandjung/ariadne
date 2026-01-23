// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { Response } from "@src/ariadne";
import * as Predicate from "effect/Predicate";

/**
 * https://stackoverflow.com/a/2117523
 * @internal
 */
export let uuid4 = function () {
  const { crypto } = globalThis as any;
  if (crypto?.randomUUID) {
    uuid4 = crypto.randomUUID.bind(crypto);
    return crypto.randomUUID();
  }
  const u8 = new Uint8Array(1);
  const randomByte = crypto ? () => crypto.getRandomValues(u8)[0]! : () => (Math.random() * 0xff) & 0xff;
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (+c ^ (randomByte() & (15 >> (+c / 4)))).toString(16),
  );
};

/** @internal */
export const ProviderOptionsKey =
    "@effect/ai-openai/OpenAiLanguageModel/ProviderOptions";

/** @internal */
export const ProviderMetadataKey =
    "@effect/ai-openai/OpenAiLanguageModel/ProviderMetadata";

const finishReasonMap: Record<string, Response.FinishReason> = {
    content_filter: "content-filter",
    function_call: "tool-calls",
    length: "length",
    stop: "stop",
    tool_calls: "tool-calls",
};

/** @internal */
export const resolveFinishReason = (
    finishReason: string | undefined,
    hasToolCalls: boolean,
): Response.FinishReason => {
    if (Predicate.isNullable(finishReason)) {
        return hasToolCalls ? "tool-calls" : "stop";
    }
    const reason = finishReasonMap[finishReason];
    if (Predicate.isNullable(reason)) {
        return hasToolCalls ? "tool-calls" : "unknown";
    }
    return reason;
};
