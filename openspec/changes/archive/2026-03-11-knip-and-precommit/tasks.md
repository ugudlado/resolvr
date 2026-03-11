# Tasks: Knip + Pre-commit Enhancements

## Phase 1: Knip Setup

### T001 ✓ Install knip as root devDependency

- Install `knip` in root `package.json` devDependencies via `pnpm add -D -w knip`
- Add `"knip": "knip"` and `"knip:fix": "knip --fix"` scripts to root `package.json`
- **Files**: `package.json` (root)

### T002 ✓ Create knip.json

- Create `knip.json` at repo root with workspace-aware config
- Entry: `apps/ui` → `src/main.tsx`, `apps/server` → `src/index.ts`
- Project: `apps/ui` → `src/**/*.{ts,tsx}`, `apps/server` → `src/**/*.ts`
- Ignore: `apps/ui/src/server/**`, `apps/*/dist/**` — **these are repo-root-relative** (top-level `ignore` is always repo-root-relative; workspace `entry`/`project` fields are workspace-relative)
- Set `ignoreExportsUsedInFile: true`
- Include `$schema` reference
- **Files**: `knip.json` (new)
- **Depends on**: T001

### T003 ✓ Verify knip runs and produces useful output

- Run `pnpm knip` from repo root
- Confirm it scans both workspaces
- Triage any false positives — add to ignore list if needed
- **Files**: `knip.json` (possibly updated with additional ignore rules)
- **Depends on**: T002

## Phase 2: Pre-commit Type-check

### T004 ✓ Add type-check to pre-commit hook

- Edit `.husky/pre-commit` to run `pnpm type-check` after `npx lint-staged`
- Verify the hook runs correctly on a staged `.ts` file with a deliberate type error
- **Files**: `.husky/pre-commit`

## Phase 3: Server ESLint

### T005 ✓ Add ESLint to apps/server

- Install ESLint and typescript-eslint in `apps/server` devDependencies
- Create `apps/server/eslint.config.js` with TypeScript-aware rules:
  - `@typescript-eslint/no-explicit-any: error`
  - `@typescript-eslint/no-unused-vars: error` (with `argsIgnorePattern: "^_"`)
  - Ignore `dist/**`
- Add `"lint": "eslint ."` script to `apps/server/package.json`
- **Files**: `apps/server/eslint.config.js` (new), `apps/server/package.json`

### T006 ✓ Add server files to root lint-staged

- Add `"apps/server/src/**/*.ts"` entry to root `package.json` lint-staged config
- Commands: `pnpm -C apps/server exec eslint --no-warn-ignored` and `prettier --write` (mirrors the UI pattern — ESLint lives in `apps/server/node_modules`)
- Update root `lint` script: `pnpm --filter @local-review/ui lint && pnpm --filter @local-review/server lint`
- **Files**: `package.json` (root)
- **Depends on**: T005

### T007 ✓ Fix any ESLint errors in existing server code

- Run `pnpm -C apps/server lint` and fix any errors surfaced in existing server files
- Likely: unused variables in route handlers (note: `any` types are `warn` not `error`, so won't block)
- Use `_` prefix for intentionally unused args/vars to suppress warnings cleanly
- **Files**: `apps/server/src/**/*.ts` (as needed)
- **Depends on**: T005, T006

## Phase 4: Type-aware ESLint Hardening

### T008 ✓ Upgrade UI ESLint to recommendedTypeChecked

- In `apps/ui/eslint.config.js`, replace `tseslint.configs.recommended` with `tseslint.configs.recommendedTypeChecked`
- Add `parserOptions: { projectService: true }` to `languageOptions`
- Add new rules per design: `no-floating-promises` (error), `no-misused-promises` (error), `await-thenable` (error), `require-await` (warn), `no-unnecessary-type-assertion` (warn)
- Add type-unaware additions: `no-non-null-assertion` (warn), `prefer-nullish-coalescing` (warn), `prefer-optional-chain` (warn), `no-duplicate-enum-values` (error)
- Disable noisy unsafe rules: `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`, `no-unsafe-return`, `no-unsafe-call`, `restrict-template-expressions` → all `"off"`
- **Files**: `apps/ui/eslint.config.js`

### T009 ✓ Fix type-aware lint errors in existing UI code

- Run `pnpm -C apps/ui lint` and triage errors surfaced by new type-aware rules
- Focus on: unawaited promises in event handlers and useEffect callbacks
- Use `void asyncFn()` to explicitly discard promise where intentional (satisfies `no-floating-promises`)
- **Files**: `apps/ui/src/**/*.{ts,tsx}` (as needed)
- **Depends on**: T008

### T010 ✓ Upgrade server ESLint to recommendedTypeChecked

- In `apps/server/eslint.config.js` (created in T005), upgrade to `recommendedTypeChecked`
- Add same rule set as UI (minus React-specific rules)
- Add `parserOptions: { projectService: true }`
- **Files**: `apps/server/eslint.config.js`
- **Depends on**: T005, T008 (consistency — do UI first)

### T011 ✓ Fix type-aware lint errors in existing server code

- Run `pnpm -C apps/server lint` and fix errors from type-aware rules
- Likely: unawaited Hono route handlers, unneeded type assertions
- **Files**: `apps/server/src/**/*.ts` (as needed)
- **Depends on**: T010

## Phase 5: Documentation + Verification

### T012 ✓ Update CLAUDE.md with new commands

- Add `pnpm knip` and `pnpm knip:fix` to the Commands section
- Note that knip is run at feature-complete time (not pre-commit)
- Add `pnpm lint` (both workspaces) to the Code Quality section
- Note type-aware ESLint rules and the key ones to know (`no-floating-promises`)
- **Files**: `CLAUDE.md`

### T013 ✓ End-to-end verification

- Stage a file with a type error → confirm pre-commit blocks
- Stage a file with an unawaited promise → confirm `no-floating-promises` blocks
- Stage a server file with unused variable → confirm lint-staged blocks
- Run `pnpm knip` → confirm both workspaces scanned, no false positives
- Run `pnpm knip:fix` → confirm it would remove flagged exports
- **Files**: none (verification only)
- **Depends on**: T001–T012
