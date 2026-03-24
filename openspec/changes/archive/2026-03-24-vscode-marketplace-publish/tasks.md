# Tasks — 2026-03-24-vscode-marketplace-publish

## Phase 1

- [x] T-1: Update publisher ID in apps/vscode/package.json
  - **Why**: Publisher `local-review` is claimed; `ugudlado` is the chosen alternative. Satisfies UC-E1 and AC1/AC4.
  - **Files**: `apps/vscode/package.json`
  - **Verify**: `"publisher"` field is `"ugudlado"`. Full extension ID becomes `ugudlado.local-review-vscode`.

- [x] T-2: Add vsce publish step to release-prep.md + update report section
  - **Why**: Automates marketplace publishing as part of each release. Satisfies UC-3, UC-E2, AC3, AC6, AC7.
  - **Files**: `.claude/commands/release-prep.md`
  - **Verify**: New step 8 exists with `--packagePath`, VSCE_PAT guard, all error modes, updated report section.

- [x] T-3: Update README.md VS Code extension install instructions
  - **Why**: Users need the marketplace install command as the primary method. Satisfies UC-1, UC-E3, AC5.
  - **Files**: `README.md`
  - **Verify**: `code --install-extension ugudlado.local-review-vscode` is primary; `.vsix` is fallback.
