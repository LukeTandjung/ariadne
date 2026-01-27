import { defineWorkspace } from "bunup";

export default defineWorkspace([
    {
        name: "ariadne",
        root: "packages/ariadne",
        config: {
            entry: ["src/index.ts"],
            format: ["esm", "cjs"],
            dts: { inferTypes: true },
        },
    },
    {
        name: "dedalus-labs",
        root: "packages/dedalus-labs",
        config: {
            entry: ["src/index.ts"],
            format: ["esm", "cjs"],
            dts: { inferTypes: true },
        },
    },
]);
