# Proposal: Knip Dead Code Cleanup

## Why

The knip tooling was set up in the `knip-and-precommit` feature and merged to main. Running `pnpm knip` now reports 18 unused files, 11 unused dependencies, 15 unused exports, and 2 configuration hints. This noise makes knip less useful as a guardrail — a clean baseline means future dead code is immediately visible.

## What Changes

Remove all dead code identified by knip analysis:

- Delete 18 unused files (old components from pre-redesign)
- Remove 8 unused dependencies and 3 unused devDependencies
- Trim 12 unused exports and 3 unused exported types
- Fix 1 duplicate export
- Clean knip.json configuration (remove redundant entry patterns, add ignoreDependencies for CSS-imported fonts)

## Capabilities

### New

- Clean `pnpm knip` baseline (zero findings)
- `ignoreDependencies` config for known false positives (`@fontsource/*`)

### Modified

- Reduced bundle size from removing unused dependencies
- Cleaner import surface from trimmed exports

## Alternatives Considered

No library search needed — this is a pure cleanup task using existing knip tooling.

**Keep testing-library devDeps for future use** — Rejected. Only 1 test file exists and it uses plain vitest, not testing-library. Better to keep knip clean and re-add when component tests are written.

**Keep zustand/immer for potential future use** — Rejected. Zero imports exist. State is managed inline with React hooks. Re-adding is trivial if needed.

## Impact

- No breaking changes — all removed code is unreferenced
- No migration needed
- Smaller `node_modules` and cleaner dependency tree
- `pnpm knip` becomes a reliable zero-noise quality gate

## Linear Ticket

none
