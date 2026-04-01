---
description: Prepare a release — changelog, version bumps, and git tag
model: haiku
---

# Release Prep

Prepare a release for the local-code-review VS Code extension: generate changelog from commits since last tag, update CHANGELOG.md, bump versions, then tag.

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

**c) `apps/vscode/package.json`** — Bump the `"version"` field to x.y.z.

Read each file before editing. Use Edit to update version fields in-place.

### 5. Build VS Code Extension

Build and package the VS Code extension `.vsix`:

```bash
cd apps/vscode
pnpm exec vsce package --no-dependencies
```

This produces `apps/vscode/local-code-review-x.y.z.vsix`. Verify the file was created and the version in the filename matches.

### 6. Commit and Tag

Stage all changed files:

```bash
git add CHANGELOG.md package.json apps/vscode/package.json pnpm-lock.yaml
git commit -m "chore: release vx.y.z"
git tag vx.y.z
```

### 7. Publish to VS Code Marketplace

Publish the extension to the VS Code Marketplace using the prebuilt `.vsix` from step 5:

```bash
cd apps/vscode
VSIX_PATH="local-code-review-$(node -p "require('./package.json').version").vsix"
if [ -z "$VSCE_PAT" ]; then
  echo "MARKETPLACE_STATUS=skipped: VSCE_PAT not set — run manually after setting the env var."
else
  pnpm exec vsce publish --pat "$VSCE_PAT" --packagePath "$VSIX_PATH" \
    && echo "MARKETPLACE_STATUS=published" \
    || echo "MARKETPLACE_STATUS=failed — see output above. GitHub release proceeding."
fi
```

The publish step is **non-blocking** — any failure echoes a status and proceeds to step 8.

### 8. Push and Create GitHub Release

Push commits and tags, then create a GitHub release with the `.vsix` asset:

```bash
cd $HOME/code/review
git push origin main --tags
```

Extract the changelog entry for this version into a temp file, then create the GitHub release:

```bash
gh release create vx.y.z \
  apps/vscode/local-code-review-x.y.z.vsix \
  --title "vx.y.z" \
  --notes-file <temp-changelog-file>
```

Verify the release was created:

```bash
gh release view vx.y.z
```

### 9. Report

Output:

- Release version
- Number of changelog entries
- Files updated (CHANGELOG.md, package.json, vscode/package.json)
- VS Code extension `.vsix` path and size
- Tag name created
- GitHub release URL
- VS Code Marketplace publish status (published / skipped with reason)
- Remind user to:
  - Install via marketplace: `code --install-extension ugudlado.local-code-review`
  - Or install from `.vsix`: `code --install-extension apps/vscode/local-code-review-x.y.z.vsix`
  - Verify marketplace listing at: https://marketplace.visualstudio.com/items?itemName=ugudlado.local-code-review
