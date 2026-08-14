# Obsidian community plugin

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm**.
- **Bundler: esbuild**.
- Types: `obsidian` type definitions.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## File & folder conventions

```
src/
  main.ts           # Plugin entry point, lifecycle management
  types/            # Shared type definitions
  settings/         # Settings interface, UI components
  views/            # Modal components (ConsistencyModal, etc.)
  services/         # Business logic services
  utils/            # Utility functions
```

## Coding conventions

- TypeScript with `strict: true`.
- Keep `main.ts` minimal: Focus only on plugin lifecycle.
- Single responsibility per module.
- Bundle everything into `main.js`.
- Prefer `async/await` over promise chains.

## Lint / typecheck process (WARNING — do not dirty the tree)

The repo is currently ESLint-clean (283 → 0 messages) and `tsc` green.
**Never** run `npm run lint --fix` and **never** run a bare `npx eslint`:
`npx eslint` resolves to global ESLint v10.8.1 and `--fix` rewrites `as any`
→ `as unknown`, which breaks `tsc`. Only:

```bash
# lint a single file
& ".\node_modules\.bin\eslint.cmd" src/<file>
# lint whole src
& ".\node_modules\.bin\eslint.cmd" src
# typecheck
npx tsc -noEmit -skipLibCheck
# build (runs tsc + esbuild)
npm run build
```

Key rules used by `eslint-plugin-obsidianmd` and their fixes are documented in
`MD Butler/03-Lint-Learnings.md` in the Knowledge-plus vault and in the opencode
skill `obsidian-plugin-lint`.
