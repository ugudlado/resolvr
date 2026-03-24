# Spec: Publish VS Code Extension to Marketplace

## Overview

Publish the local-review VS Code extension to the VS Code Marketplace so users can install it via `code --install-extension` with the extension ID instead of downloading a `.vsix` file manually. This also enables automatic updates when new versions are released. The change is purely procedural -- no extension code changes are needed.

## Acceptance Criteria

1. A publisher is registered on the VS Code Marketplace (preferably `local-review`; if claimed, an alternative such as `ugudlado` is used and `apps/vscode/package.json` is updated before first publish). The extension is published and installable via `code --install-extension <publisher>.local-review-vscode`. [traces: UC-1, UC-E1]

2. When a new version is released via the marketplace, VS Code auto-update notifies users with the extension installed -- no manual download or reinstall required. [traces: UC-2]

3. The `release-prep.md` command includes a `vsce publish` step that publishes the extension to the marketplace as part of each release, after the `.vsix` is built and before the GitHub release is created. The step documents the `VSCE_PAT` requirement and includes clear error guidance for PAT expiration. [traces: UC-3, UC-E2]

4. If the publisher ID `local-review` is already claimed on the marketplace, an alternative publisher ID is chosen and `apps/vscode/package.json` is updated accordingly before the first publish. [traces: UC-E1]

5. The README installation instructions for the VS Code extension are updated to use the marketplace extension ID as the primary install method, with the `.vsix` download retained as a fallback. Non-VS Code users are unaffected — the plugin itself makes no attempt to install the extension. [traces: UC-1, UC-E3]

6. The GitHub release `.vsix` asset continues to be produced and attached -- the marketplace publish is additive, not a replacement. [traces: UC-3]

7. The `release-prep.md` report step mentions the marketplace publish status (success or skipped) alongside the existing `.vsix` path output. [traces: UC-3]

## Out of Scope

- Supporting VS Code forks (Cursor, Windsurf) -- only VS Code proper
- Auto-installing the extension from the SessionStart hook
- Removing the `.vsix` GitHub release asset
- CI/CD automation for `vsce publish` (manual release process for now)
- Changes to the extension source code itself

## Dependencies / Prerequisites

- **Publisher account**: A verified publisher must be registered at https://marketplace.visualstudio.com/manage (one-time manual step)
- **Personal Access Token (PAT)**: An Azure DevOps PAT with `Marketplace > Manage` scope, stored locally as `VSCE_PAT` environment variable
- **Publisher ID availability**: Must verify `local-review` is available at https://marketplace.visualstudio.com/publishers/local-review before first publish
- **`@vscode/vsce` v3.0.0**: Already present in `apps/vscode/package.json` devDependencies -- no new dependency needed

## Review Summary

**[codex]** Round 1 — 2 critical, 3 suggestions:

- `critical` Publisher ID fallback inconsistency: spec/design hardcoded `local-review.local-review-vscode` while fallback path required a different publisher. **Resolved**: AC1 now uses `<publisher>.local-review-vscode`; all design.md references parameterized.
- `critical` `vsce publish` artifact drift: design used `--no-dependencies` which rebuilds from source, diverging from the GitHub `.vsix`. **Resolved**: design now uses `--packagePath` to publish the prebuilt `.vsix`.
- `suggestion` One-time setup missing browser-side publisher creation step. **Resolved**: design.md now includes marketplace.visualstudio.com "Create publisher" step before `vsce login`.
- `suggestion` Missing UC for `VSCE_PAT` not set and duplicate version publish. **Addressed**: design.md error table covers both; minor traceability gap accepted as out-of-scope for rapid schema.
- `suggestion` UC-E3 ambiguity: "no errors" is runtime behavior, not just a README update. **Resolved**: AC5 now explicitly states "the plugin itself makes no attempt to install the extension."
