# Design: Knip Dead Code Cleanup

## Approach

Pure deletion — no new code, no architectural changes. Each category of dead code is handled independently.

## Execution Order

Dependencies must be removed before files are deleted, because deleting files that import removed dependencies would cause transient type errors during the process.

```
1. Clean knip.json config          (no deps)
2. Remove unused dependencies      (no deps)
3. pnpm install                    (updates lockfile)
4. Delete unused files             (no deps on step 2)
5. Trim unused exports + types     (no deps on step 4)
6. Fix duplicate export            (no deps)
7. Rebuild dist                    (depends on all above)
8. Verify (knip, types, lint)      (depends on all above)
```

## Risk Assessment

**Low risk** — all changes are deletions of unreferenced code. The verification step (`pnpm knip && pnpm type-check && pnpm lint && pnpm build`) catches any incorrect removal.

**False positive handling**: `@fontsource/*` packages are imported via CSS `@import` which knip cannot trace. Adding them to `ignoreDependencies` in knip.json prevents future false alarms.

## Decisions

| Decision                          | Rationale                                                |
| --------------------------------- | -------------------------------------------------------- |
| Remove `@testing-library/*`       | No component tests use it; 1 test file uses plain vitest |
| Remove `zustand` + `immer`        | Zero imports; state managed with React hooks             |
| Keep `@fontsource/*`              | CSS `@import` in `index.css`; add to knip ignore         |
| Keep `claude-agent-sdk` in server | Used by `resolver-daemon.ts`; only remove from UI + root |
| Single commit group               | Small enough for one logical commit                      |
