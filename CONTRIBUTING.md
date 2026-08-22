# Contributing

## Setup

Requirements: Node.js 22 and npm 11.17.

```sh
npm ci
npm exec -- playwright install chromium
npm run verify
```

Use `npm run dev` for the React playground. Use `npm run format` before committing formatting changes.

## Package changes

Keep chess rules, FEN/PGN parsing, and move validation outside the renderer. The core package owns its DOM subtree; the React package only adapts lifecycle and configuration.

Once the packages have been published, run `npm run changeset` for every user-visible package change. Select the affected packages, choose the semantic version bump, and write a consumer-facing summary. Repository-only tooling and documentation changes do not need a changeset.

## Pull requests

Pull requests must pass `npm run verify`, which covers formatting, linting, type checking, unit tests, package validation, packed-consumer installation, and Chromium rendering. Keep changes focused and update public documentation when the interface or support contract changes.
