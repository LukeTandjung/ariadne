<img src="./assets/ariadne_service_logo.png" align="left" width="200" alt="Ariadne logo of a spool of thread" style="margin-right: 20px; margin-bottom: 10px;">

Ariadne is an agent SDK, built from the API surface of Effect-AI and the Dedalus Labs backend.

<br clear="left">

It aims to provide
 - Full type-safety and observability from error accumulation.
 - Composability for ease of evaluation and unit testing.

## Installation

```bash
bun install ariadne
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Develop with watch mode
bun run dev

# Run tests
bun run test

# Lint and format
bun run lint
bun run format
```

## Effect AI Packages

This repo includes a fork of the [Effect AI packages](https://github.com/Effect-TS/effect/tree/main/packages/ai). Upstream changes are monitored and selectively merged as needed.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT
