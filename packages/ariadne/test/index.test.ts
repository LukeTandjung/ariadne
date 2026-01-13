import { test, expect } from "bun:test";
import { greet } from '../src';

test("ariadne package should greet correctly", () => {
  expect(greet('World')).toBe('Hello, World! Welcome to the ariadne package.');
});
