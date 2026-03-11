# Design: Knip + Pre-commit Enhancements

## Context

The project is a pnpm monorepo with two workspaces (`apps/ui` — Vite/React, `apps/server` — Hono/Node). Husky + lint-staged already handle ESLint and Prettier on staged UI files. The gap is: no dead-code detection, no type-check gate, and no server-side linting.

## Goals / Non-Goals

### Goals

- Knip configured for monorepo with correct workspace entry points
- `pnpm knip` and `pnpm knip:fix` as root-level scripts
- `pnpm type-check` added to pre-commit hook
- Server ESLint with TypeScript-aware rules
- Server files covered in lint-staged
- Both UI and server ESLint upgraded to `recommendedTypeChecked` with promise rules

### Non-Goals

- Knip in the pre-commit hot path
- Strict "zero warnings" enforcement (informational output is fine)
- Custom knip plugins or reporters
- Enabling `no-unsafe-*` rules (too noisy; type safety covered by `tsc`)

## Technical Design

### Components

**`knip.json` (repo root)**

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "workspaces": {
    "apps/ui": {
      "entry": ["src/main.tsx"],
      "project": ["src/**/*.{ts,tsx}"]
    },
    "apps/server": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.ts"]
    }
  },
  "ignore": ["apps/ui/src/server/**", "apps/*/dist/**"],
  "ignoreExportsUsedInFile": true
}
```

Key decisions:

- `ignoreExportsUsedInFile: true` — suppresses false positives for exports used only within the same file (common in React components)
- Vite plugin is auto-detected by knip when `vite.config.ts` exists in the workspace — no explicit plugin config needed
- `apps/ui/src/server/**` ignored because `resolver-daemon.ts` is a server file living in the UI tree (used by the plugin agent, not imported by the React app)

**`package.json` (root) — script additions**

```json
{
  "scripts": {
    "knip": "knip",
    "knip:fix": "knip --fix",
    "lint": "pnpm --filter @local-review/ui lint && pnpm --filter @local-review/server lint"
  },
  "lint-staged": {
    "apps/server/src/**/*.ts": [
      "pnpm -C apps/server exec eslint --no-warn-ignored",
      "prettier --write"
    ]
  }
}
```

The existing `lint-staged` entries for UI files remain unchanged. Note: use `pnpm -C apps/server exec eslint` (mirrors the UI pattern) because ESLint lives in `apps/server/node_modules`, not the root.

**`.husky/pre-commit`**

```sh
npx lint-staged
pnpm type-check
```

`pnpm type-check` runs `tsc --noEmit` across both `tsconfig.app.json` and `tsconfig.node.json` (UI) plus the server tsconfig. All type errors block the commit.

**`apps/ui/eslint.config.js` — updated rules section**

Upgrade from `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` and add `projectService: true`. Add type-unaware and type-aware rule additions, disable noisy unsafe rules:

```js
export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true, // auto-discovers tsconfig.json files
      },
    },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      // --- React ---
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      // --- Dead code ---
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-unreachable": "error",

      // --- Code quality ---
      "no-nested-ternary": "warn",
      eqeqeq: ["error", "always"],
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // --- TypeScript (type-unaware) ---
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports" },
      ],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-duplicate-enum-values": "error",

      // --- TypeScript (type-aware, from recommendedTypeChecked) ---
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // --- Disable noisy rules (type safety covered by tsc) ---
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
);
```

**`apps/server/eslint.config.js`**

Same `recommendedTypeChecked` upgrade. No React plugins. Uses same rule set minus React-specific ones:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // --- Dead code ---
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // --- TypeScript (type-unaware) ---
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-duplicate-enum-values": "error",

      // --- TypeScript (type-aware) ---
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // --- Disable noisy unsafe rules ---
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
);
```

**Why `projectService: true` instead of `project: './tsconfig.json'`**: The modern API (typescript-eslint v8+) uses `projectService` which auto-discovers tsconfig files and is faster. No need to specify paths manually in a monorepo.

### Data Flow

```
git commit
    │
    ▼
lint-staged
    ├── apps/ui/src/**/*.{ts,tsx}   → ESLint (type-aware) + Prettier  [UPGRADED]
    ├── apps/server/src/**/*.ts     → ESLint (type-aware) + Prettier  [NEW]
    └── **/*.{json,css,html,md}    → Prettier
         catches: no-floating-promises, no-misused-promises,
                  await-thenable, prefer-optional-chain, etc.
    │
    ▼
pnpm type-check                                                    [NEW]
    ├── apps/ui: tsc -p tsconfig.app.json --noEmit
    ├── apps/ui: tsc -p tsconfig.node.json --noEmit
    └── apps/server: tsc --noEmit
    │
    ▼
commit succeeds ✓

─ ─ ─ ─ ─ ─ ─ ─ (separate, on-demand) ─ ─ ─ ─ ─ ─ ─ ─

pnpm knip                                                          [NEW]
    ├── apps/ui: entry=src/main.tsx, Vite plugin auto-detected
    └── apps/server: entry=src/index.ts
         → unused exports, files, dependencies report
```

### Error Handling

- If `pnpm type-check` fails, the commit is blocked with tsc output. Agent sees the error in the hook output and can fix before retrying.
- If ESLint fails on server files, lint-staged blocks with ESLint output.
- Knip is informational — no CI gate, no commit gate. Run manually.

## Risks & Trade-offs

| Risk                                                        | Mitigation                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Pre-commit now ~8–12s slower (type-aware lint + type-check) | Acceptable — catches real promise/type bugs agents commonly produce  |
| Knip false positives on `apps/ui/src/server/`               | Covered by ignore rule                                               |
| `no-floating-promises` fires on existing UI code            | T007-equivalent pass needed for UI too — triage and fix or suppress  |
| `pnpm type-check` slow on first run (cold cache)            | tsc incremental cache (`tsconfig.tsbuildinfo`) speeds up repeat runs |
| `projectService: true` slower than `project: path`          | Acceptable tradeoff — auto-discovery is simpler in a monorepo        |

## Open Questions

- Should knip eventually run in CI on PRs? (Not in scope — can add later as a workflow step)
- Should `knip:fix` be safe to run without review? (Flag for human review; `--fix` only touches exports, not files)
