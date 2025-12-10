# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Overview

This is a GitHub Action template built with TypeScript. It uses Rollup to bundle
TypeScript source code into a single JavaScript file (`dist/index.js`) that
GitHub Actions executes. Both source TypeScript and the generated JavaScript are
committed to the repository.

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests (CI environment with experimental VM modules)
npm run ci-test

# Bundle TypeScript to JavaScript (includes formatting)
npm run bundle

# Format code
npm run format:write

# Check formatting
npm run format:check

# Lint code
npm run lint

# Generate coverage badge
npm run coverage

# Run all checks (format, lint, test, coverage, bundle)
npm run all

# Test action locally with .env file
npm run local-action

# Watch mode for bundling
npm run package:watch
```

## Build System

The action uses **Rollup** to bundle TypeScript into a single JavaScript file:

- Entry point: `src/index.ts`
- Output: `dist/index.js` (ES module format)
- Config: `rollup.config.ts`
- Plugins: TypeScript compilation, Node resolution, CommonJS support

**CRITICAL**: After modifying any files in `src/`, you MUST run `npm run bundle`
to regenerate `dist/index.js`. The `check-dist.yml` workflow enforces that the
dist directory is up-to-date.

## Architecture

### Entry Point Flow

1. `src/index.ts` - Simple entrypoint that imports and executes `run()` from
   `main.ts`
2. `src/main.ts` - Contains the main action logic in the `run()` function
3. Action reads inputs via `@actions/core` package (`core.getInput()`)
4. Action sets outputs via `core.setOutput()`
5. Errors are caught and reported via `core.setFailed()`

### TypeScript Configuration

- Target: ES2022
- Module system: NodeNext (ESM with `.js` imports in TypeScript files)
- Strict mode enabled
- Output directory: `./dist` (used for type checking, not runtime)
- Source directory: `src/` only (excludes `__fixtures__`, `__tests__`, `dist/`,
  etc.)

### Testing

- Framework: Jest with `ts-jest` preset
- Test files: `__tests__/**/*.test.ts`
- Fixtures: `__fixtures__/` directory
- Coverage collected from: `./src/**`
- Tests run with experimental VM modules
  (`NODE_OPTIONS=--experimental-vm-modules`)

## Key Conventions

### Code Style

- Use `@actions/core` for logging (not `console`)
- Import local TypeScript files with `.js` extension (e.g.,
  `import { wait } from './wait.js'`)
- Follow existing TypeScript patterns and strict type checking
- Document functions with JSDoc comments
- Focus comments on "why" not "what"

### GitHub Actions Specifics

- Action metadata defined in `action.yml` (inputs, outputs, branding)
- Actions run on Node 24 (`runs.using: node24`)
- Debug logs only appear when `ACTIONS_STEP_DEBUG` secret is true
- Use `core.debug()`, `core.info()`, `core.warning()`, `core.error()` for
  logging
- Error handling: catch errors and call `core.setFailed()` to fail the workflow

### Versioning

- Follow Semantic Versioning
- Update version in `package.json` when making changes
- Use `script/release` helper for creating releases
- Major version tags (e.g., `v1`, `v2`) point to latest minor/patch in that
  major version

## Important Notes

- Do NOT review changes to `dist/` folder in PRs - it's auto-generated
- The `dist/index.js` file closely mirrors the TypeScript source it's generated
  from
- All automated workflows (CI, linting, CodeQL, license checks) must pass
- The `licensed.yml` workflow is initially disabled and needs manual enablement
- Repository uses `.node-version` file for Node.js version management (24+)
