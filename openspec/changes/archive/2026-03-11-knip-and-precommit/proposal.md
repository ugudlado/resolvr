# Proposal: Knip + Pre-commit Enhancements for Agentic Coding

## Why

Agentic coding sessions produce code fast, but leave behind dead code that manual review often misses:

- Unused exports from over-engineered helpers
- Zombie files from abandoned approaches
- Orphaned TypeScript types for unbuilt features
- Type errors not caught until CI (ESLint doesn't type-check)
- Server-side code with zero lint coverage (no ESLint on `apps/server`)

The current pre-commit pipeline (lint-staged: ESLint + Prettier on staged UI files) is good for style but silent on these issues.

## What Changes

1. **Knip**: Install and configure for the pnpm monorepo. Run manually at feature-complete time to surface dead code before merging.
2. **Pre-commit type-check**: Add `pnpm type-check` to the Husky pre-commit hook so type errors surface at commit time, not CI.
3. **Server ESLint**: Add basic ESLint config to `apps/server` and include server TypeScript files in lint-staged. Agents write server code without any lint feedback today.

## Capabilities

### New

- `pnpm knip` — scans both workspaces for unused exports, dependencies, and files
- `pnpm knip:fix` — auto-removes unused exports where safe
- Type errors caught pre-commit (not just in CI)
- Server TypeScript linted on commit (ESLint with TypeScript rules)

### Modified

- `.husky/pre-commit` — adds `pnpm type-check` after lint-staged
- `package.json` (root) — adds `knip` and `knip:fix` scripts, updates lint-staged to include server files
- `apps/server/` — gains `eslint.config.js`

## Alternatives Considered

**Knip in pre-commit (not just on-demand)**
Rejected. Knip scans the full project — 5–15s — too slow for a per-commit hook. It's a feature-complete health check, not a hot-path gate. Running it on-demand with `pnpm knip` before merge is the right model.

**Type-check only in CI**
Current state. The problem: agents commit type-broken code and don't discover it until the CI run, which may be minutes later (or not at all if CI isn't set up). Pre-commit type-check costs ~3–5s and catches this immediately.

**oxlint instead of ESLint for server**
Considered. Oxlint is faster but lacks TypeScript-aware rules. Since type-aware linting is the main value for server code, ESLint with `typescript-eslint` is the right choice.

## Impact

- Pre-commit hook takes ~5–8s longer (type-check addition)
- No breaking changes — all new config files, additive script additions
- `apps/ui/src/server/resolver-daemon.ts` may appear in knip output as an orphan (server-side file in UI tree) — added to knip ignore list

## Linear Ticket

none
