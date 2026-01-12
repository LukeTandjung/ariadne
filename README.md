<img src="./assets/sakhal_service_logo.jpeg" align="left" width="200" alt="Sakhal logo of a deer and a dead tree" style="margin-right: 20px; margin-bottom: 10px;">

Sakhal is a batteries-included fullstack AI agent framework. This means it handles fine-tuning, open source model deployment, and continuous improvement feedback loops

Planned language support includes Python, Typescript, and Rust.

**NOTE: THIS REPOSITORY IS A WORK IN PROGRESS AND IS NOT READY FOR SERIOUS PRODUCTION USE YET**

<br clear="left">

It aims to provide
 - Full type-safety and observability from error accumulation.
 - Composability for ease of evaluation and unit testing.
 - An intuitive graph API that supports all types of multi-agent architecture

## Development Setup

### Initial Setup

```bash
git clone git@github.com:your-username/sakhal.git
cd sakhal

# Add Effect as a remote for syncing AI packages
git remote add effect https://github.com/Effect-TS/effect.git
```

### Syncing Effect AI Packages

This repo includes a fork of the Effect AI packages. To pull upstream changes:

```bash
# Shallow fetch (only latest commit, much faster)
git fetch effect --depth=1

# Pull updates for each package
git subtree pull --prefix=packages/ai/ai effect main --squash
git subtree pull --prefix=packages/ai/openai effect main --squash
git subtree pull --prefix=packages/ai/anthropic effect main --squash
```

### Pushing Changes

Your changes push to this repo, not Effect:

```bash
git push origin master
```

The `effect` remote is read-only for syncing upstream changes.
