---
description: Prepare a release — changelog, version bumps, and git tag
model: haiku
---

# Release Prep

Prepare a release for the local-review plugin: generate changelog from commits since last tag, update CHANGELOG.md, bump versions in this repo and the marketplace, then tag.

## Arguments

$ARGUMENTS — The version tag to create, e.g. v1.2.0 or 1.2.0. Normalize to x.y.z for changelog headings and vx.y.z for git tags.

## Process

### 1. Determine Range

Find the latest existing git tag and list commits between it and HEAD:

```bash
git describe --tags --abbrev=0 2>/dev/null
git log <LAST_TAG>..HEAD --oneline
```

If no previous tag exists, use all commits.

### 2. Analyze Commits

Read each commit message and classify into:

- Added, marked with + prefix: New features, new UI elements, new commands/agents.
- Changed, marked with \* prefix: Refactors, improvements, behavior changes.
- Fixed, marked with ! prefix: Bug fixes.
- Removed, marked with - prefix: Deleted features, removed code paths.

Rules:

- Keep descriptions concise, one line per change
- Group by area using subheadings (UI, Server, Plugin) only if changes span multiple — skip if all in one area
- Within each group, order: + first, then \*, then !, then -

### 3. Draft Changelog Entry

Present the draft to the user in this format:

```
## x.y.z — YYYY-MM-DD

+ Added feature description
* Changed something
! Fixed a bug
- Removed something
```

WAIT for user approval before writing.

### 4. Update Files

After approval, update all version files:

**a) CHANGELOG.md** — Insert the approved entry below the `# Changelog` heading, above the previous release.

**b) `package.json`** — Bump the root `"version"` field to x.y.z.

**c) `apps/ui/src/config/app.ts`** — Update `APP_VERSION` to "x.y.z".

**d) `.claude-plugin/plugin.json`** — Bump the `"version"` field to x.y.z.

**e) `.claude-plugin/marketplace.json`** — Bump the `"version"` for the `local-review` entry to x.y.z.

**f) `$HOME/code/claude-marketplace/.claude-plugin/marketplace.json`** — Bump the `"version"` for the `local-review` plugin entry to x.y.z.

**g) `apps/vscode/package.json`** — Bump the `"version"` field to x.y.z.

Read each file before editing. Use Edit to update version fields in-place.

### 5. Build Dist Artifacts

Run a full build so that committed dist artifacts match the release version:

```bash
pnpm build
```

Verify the build succeeds before proceeding. This ensures the plugin's dist (used by `node apps/server/dist/index.js` at runtime) matches the source.

### 6. Build VS Code Extension

After version bumps, build and package the VS Code extension `.vsix`:

```bash
cd apps/vscode
pnpm exec vsce package --no-dependencies
```

This produces `apps/vscode/local-review-vscode-x.y.z.vsix`. Verify the file was created and the version in the filename matches.

### 7. Commit and Tag

Stage all changed files including rebuilt dist:

```bash
git add CHANGELOG.md package.json apps/ui/src/config/app.ts .claude-plugin/plugin.json .claude-plugin/marketplace.json apps/vscode/package.json pnpm-lock.yaml apps/server/dist/ apps/ui/dist/ packages/schema/dist/
git commit -m "chore: release vx.y.z"
```

Then in the marketplace repo, commit the version bump:

```bash
cd $HOME/code/claude-marketplace
git add .claude-plugin/marketplace.json
git commit -m "chore: bump local-review to vx.y.z"
```

Then tag this repo:

```bash
cd $HOME/code/review
git tag vx.y.z
```

### 8. Publish to VS Code Marketplace

Publish the extension to the VS Code Marketplace using the prebuilt `.vsix` from step 6:

```bash
cd apps/vscode
VSIX_PATH="local-review-vscode-$(node -p "require('./package.json').version").vsix"
if [ -z "$VSCE_PAT" ]; then
  echo "MARKETPLACE_STATUS=skipped: VSCE_PAT not set — run manually after setting the env var."
else
  pnpm exec vsce publish --pat "$VSCE_PAT" --packagePath "$VSIX_PATH" \
    && echo "MARKETPLACE_STATUS=published" \
    || echo "MARKETPLACE_STATUS=failed — see output above. GitHub release proceeding."
fi
```

The `--packagePath` flag publishes the exact same `.vsix` that will be attached to the GitHub release, ensuring both distributions are identical. The publish step is **non-blocking** — any failure echoes a status and proceeds to step 9.

Common failure modes:

- **`VSCE_PAT` not set**: Guarded above — skips with message. Set `export VSCE_PAT="<token>"` in `~/.zshrc` and publish manually.
- **PAT expired**: `vsce` will fail with an auth error. Regenerate at https://dev.azure.com > User Settings > Personal Access Tokens.
- **Network error**: Retry the command once. If still failing, note in report and proceed.
- **Version already published**: Non-fatal. GitHub release still proceeds.

### 9. Push and Create GitHub Release

Push commits and tags, then create a GitHub release with the `.vsix` asset:

```bash
cd $HOME/code/review
git push origin main --tags
```

```bash
cd $HOME/code/claude-marketplace
git push
```

Extract the changelog entry for this version (everything between the `## x.y.z` heading and the next `##` heading) into a temp file, then create the GitHub release:

```bash
cd $HOME/code/review
gh release create vx.y.z \
  apps/vscode/local-review-vscode-x.y.z.vsix \
  --title "vx.y.z" \
  --notes-file <temp-changelog-file>
```

Verify the release was created:

```bash
gh release view vx.y.z
```

### 10. Report

Output:

- Release version
- Number of changelog entries
- Files updated (CHANGELOG.md, package.json, app.ts, plugin.json, marketplace.json x2, vscode/package.json)
- VS Code extension `.vsix` path and size
- Tag name created
- GitHub release URL
- VS Code Marketplace publish status (published / skipped with reason)
- Remind user to:
  - Install via marketplace: `code --install-extension ugudlado.local-review-vscode`
  - Or install from `.vsix`: `code --install-extension apps/vscode/local-review-vscode-x.y.z.vsix`
  - Verify marketplace listing at: https://marketplace.visualstudio.com/items?itemName=ugudlado.local-review-vscode
