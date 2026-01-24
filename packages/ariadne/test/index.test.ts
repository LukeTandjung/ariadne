import { expect, test } from "bun:test";
import { LanguageModel } from "../src";

test("ariadne package exports LanguageModel", () => {
    expect(LanguageModel).toBeDefined();
    expect(LanguageModel.generateText).toBeDefined();
});
