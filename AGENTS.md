# Repository Guidelines

## Project Overview

`@plywise/chessboard` is a small framework-agnostic chessboard renderer. It renders a supplied `Position`; consumers own chess rules, FEN/PGN parsing, and move legality. `@plywise/chessboard-react` is the React lifecycle adapter.

## Architecture & Data Flow

- `packages/chessboard/src/index.ts` owns a `.pw-board` DOM subtree and keyed `.pw-piece` nodes. `createChessboard(host, config)` validates a `Map<Square, Piece>`, renders it, and exposes `set`, `move`, and `destroy`.
- `packages/chessboard/src/style.css` renders squares with a gradient and positions pieces from `--pw-file`, `--pw-rank`, and `--pw-animation-duration`. Keep these CSS custom properties and `data-square`/`data-color`/`data-role` attributes in sync with the renderer.
- `packages/chessboard-react/src/index.tsx` creates the imperative board once in an effect, forwards prop changes through `instance.set`, and destroys it during cleanup. Keep imperative DOM ownership out of React rendering.
- `examples/react/` is the Vite smoke-test consumer.

## Key Directories

- `packages/chessboard/src/` — renderer API and published stylesheet.
- `packages/chessboard-react/src/` — React adapter and re-exported renderer types.
- `packages/*/test/` — Node test-runner tests against built `dist/` files.
- `examples/react/` — browser example.
- `.context/brief.md` — internal scope and out-of-scope decisions.

## Development Commands

```sh
npm install
npm run check      # Biome formatting, linting, and import organization
npm run format     # apply Biome formatting
npm run build      # compile both packages
npm run typecheck  # tsc --noEmit
npm test           # build, typecheck, then both package test suites
npm run dev        # serve examples/react with Vite
```

For a focused suite: `npm run test -w @plywise/chessboard` or `npm run test -w @plywise/chessboard-react`.

## Code Conventions & Common Patterns

- TypeScript is strict; preserve `readonly` public fields, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess` compatibility.
- Use named exports and narrow domain types such as `Square`, `Color`, `Role`, and `Position` rather than loose strings or objects.
- Validate public renderer inputs at the boundary and throw `TypeError` for invalid values. Keep lifecycle misuse (`set`/`move` after `destroy`) as an `Error`.
- Treat positions as immutable input: validate/copy into a new `Map`; update keyed DOM nodes in place so moves retain their element.
- React uses `useRef` for the imperative instance and effects for create/update/destroy. Do not add React state for board DOM state.
- Biome owns formatting, linting, and import organization. Run `npm run check` before committing and `npm run format` to apply formatting.

## Important Files

- `package.json` — npm workspace scripts and Node engine.
- `biome.json` — formatter, linter, and import-organization rules.
- `tsconfig.json` — shared strict compiler contract.
- `packages/chessboard/src/index.ts` — public imperative API and validation.
- `packages/chessboard/src/style.css` — renderer CSS/DOM contract.
- `packages/chessboard-react/src/index.tsx` — React integration contract.
- `README.md` — public usage and package scope.

## Runtime/Tooling Preferences

Use Node.js 22 or later and npm; `package-lock.json` is authoritative. This is ESM-only (`"type": "module"`) TypeScript. Build with `tsc`; use Vite only for the example. Do not substitute Bun, Yarn, pnpm, a bundler, or a test framework.

## Testing & QA

Tests use Node's built-in `node:test` and `node:assert/strict`; DOM tests use JSDOM. Test files follow `packages/<package>/test/*.test.mjs` and import `../dist/index.js`, so build before invoking a package test directly. Cover observable DOM/lifecycle behavior and invalid inputs; no coverage threshold is configured. GitHub Actions runs Biome, the full test command, and npm package dry-runs.
