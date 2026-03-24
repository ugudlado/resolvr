# Discovery Brief — VS Code Extension Auto-Install via Marketplace

## What I Understand

Users install the local-review Claude plugin but must then separately download and install the VS Code extension by hand. The goal is to collapse that two-step setup into one by publishing the extension to the VS Code Marketplace, enabling simpler install commands and automatic updates.

## What Already Exists

**In codebase:**

- `hooks/session-start.sh` — runs at every `SessionStart`; handles version detection, idempotent server start, workspace registration. The `PLUGIN_ROOT` variable resolves to either the live repo or the plugin cache directory.
- `hooks/hooks.json` — `SessionStart` array; current hook runs `async: true`
- `apps/vscode/package.json` — `"publisher": "local-review"`, `"name": "local-review-vscode"`, `"version": "2.0.4"`. Full extension ID: `local-review.local-review-vscode`
- `apps/vscode/package.json` — `@vscode/vsce` v3.0.0 already a dev dependency; tooling in place
- `.claude/commands/release-prep.md` — steps 6–8 already build `.vsix` and attach to GitHub release; needs one new step for `vsce publish`
- `apps/vscode/*.vsix` — present locally (5 versioned files); `*.vsix` is in `.gitignore`

**External:**

- VS Code Marketplace: https://marketplace.visualstudio.com/manage — publisher registration, no human approval gate, automated scan only
- `vsce publish` docs: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- `code --install-extension publisher.extensionName` — works for marketplace-published extensions without a file download
- Auto-update: VS Code polls the marketplace and prompts users when a new version is available

## Build or Reuse?

**Reuse + process change.** No code changes to the extension itself. `@vscode/vsce` tooling is already installed. The only changes are: one-time publisher account setup, a `VSCE_PAT` secret, and one additional command in `release-prep.md`.

## Approaches Considered

**A: Commit .vsix to repo, auto-install from hook**

- Pros: zero network dependency, works air-gapped, simple hook logic
- Cons: no auto-updates, git history bloat (~16 KB per release), must update `.gitignore`
- Effort: Small

**C: Download .vsix from GitHub releases in hook**

- Pros: no git bloat, mirrors manual flow, network-fetches latest
- Cons: requires network + `gh` CLI, rate limiting risk, fragile failure modes
- Effort: Medium

**D: Publish to VS Code Marketplace (chosen)**

- One-time publisher account at marketplace.visualstudio.com + PAT
- Add `vsce publish --pat $VSCE_PAT` to release-prep
- Install becomes: `code --install-extension local-review.local-review-vscode`
- Auto-updates: VS Code notifies users of new versions automatically
- Pros: best install UX, auto-updates, discoverable, additive (`.vsix` on GitHub remains)
- Cons: publisher ID `local-review` may be claimed (must verify); requires PAT maintenance; public listing
- Effort: Small

**Recommendation: Approach D.** Best long-term UX with auto-updates. Fully additive — GitHub `.vsix` release continues.

## Personas

- **Developer (primary)**: Has VS Code, installs the local-review Claude plugin, expects the extension to work without a separate manual download step.
- **Upgrading user**: Already has an older extension version; expects updates to arrive automatically.
- **Non-VS Code user**: Uses the plugin for Claude integration only; no `code` binary. Expects no errors.

## Use Cases

- UC-1: First install — Developer installs plugin, then runs `code --install-extension local-review.local-review-vscode`. Extension appears in VS Code's SCM sidebar.
- UC-2: Version upgrade — Developer updates the plugin. VS Code notifies them of the extension update via marketplace auto-update. No manual download needed.
- UC-3: Release workflow — Maintainer runs release-prep. The new step `vsce publish` pushes the extension to the marketplace alongside the GitHub release.
- UC-E1: Publisher ID taken — `local-review` is claimed on marketplace. Must choose a new publisher ID and update `package.json` before first publish.
- UC-E2: PAT expired — `vsce publish` fails with auth error in release-prep. Maintainer regenerates PAT from Azure DevOps.
- UC-E3: VS Code not installed — `code` is not on `$PATH`. User follows README instructions; no hook changes needed since hook doesn't install the extension.

## Scope

**In scope:**

- Register `local-review` publisher on VS Code Marketplace (one-time manual step, documented)
- Add `vsce publish` step to `release-prep.md`
- Update README installation instructions from `.vsix` file path to marketplace extension ID
- Document `VSCE_PAT` secret requirement in `release-prep.md`
- Verify publisher ID availability

**Out of scope:**

- Supporting VS Code forks (Cursor, Windsurf) — only VS Code proper
- Auto-installing the extension from the SessionStart hook (not needed if marketplace handles updates)
- Removing the `.vsix` GitHub release asset (kept as fallback)
- CI/CD automation for `vsce publish` (manual release process for now)

## UI Direction

N/A — no UI components.

## Technical Context

- `apps/vscode/package.json:7` — `"version": "2.0.4"`, publisher `"local-review"`, name `"local-review-vscode"`
- `apps/vscode/package.json` devDependencies — `@vscode/vsce` v3.0.0 already present
- `.claude/commands/release-prep.md` lines ~80–88 — `gh release create` step; new `vsce publish` goes here
- `apps/vscode/.vscodeignore` — controls what's excluded from `.vsix` bundle
- Publisher ID to verify: https://marketplace.visualstudio.com/publishers/local-review

## Open Questions

1. **Publisher ID availability**: Is `local-review` available on the marketplace? Must verify before first publish. If taken, `publisher` in `package.json` must change (breaking change to extension ID).
2. **PAT storage**: Where should `VSCE_PAT` live? Local `~/.zshrc` for now; GitHub Actions secret for future CI.
3. **VS Code forks**: Cursor/Windsurf users won't benefit. Worth calling out in README.
