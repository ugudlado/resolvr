# Verify Before Claiming Done

Before claiming any task is complete, run and read the output of:

1. Type check (`pnpm type-check` or `npx tsc --noEmit`)
2. Tests (`pnpm test` or relevant test command)
3. Visual verification (screenshot or browser check for UI changes)

Evidence before assertions. Never claim "all tests pass" without running them.
