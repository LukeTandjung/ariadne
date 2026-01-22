import * as effectPlugin from "@effect/eslint-plugin"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsparser from "@typescript-eslint/parser"

export default [
    {
        ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts", "bunup.config.ts", "**/test/**"]
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        plugins: {
            "@typescript-eslint": tseslint,
            "@effect": effectPlugin
        },
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                projectService: true
            }
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
            "@typescript-eslint/array-type": ["error", { default: "generic" }],
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-namespace": "off"
        }
    }
]
