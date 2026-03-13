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

After approval, update these three files:

**a) CHANGELOG.md** — Insert the approved entry below the `# Changelog` heading, above the previous release.

**b) `.claude-plugin/plugin.json`** — Bump the `"version"` field to x.y.z.

```bash
cat .claude-plugin/plugin.json
```

Use Edit to update the version field in-place.

**c) `/Users/spidey/code/claude-marketplace/.claude-plugin/marketplace.json`** — Bump the `"version"` for the `local-review` plugin entry to x.y.z.

```bash
cat /Users/spidey/code/claude-marketplace/.claude-plugin/marketplace.json
```

Use Edit to update the version field in-place.

### 5. Commit and Tag

Stage all changed files and commit:

```bash
git add CHANGELOG.md .claude-plugin/plugin.json
git commit -m "chore: release vx.y.z"
```

Then in the marketplace repo, commit the version bump:

```bash
cd /Users/spidey/code/claude-marketplace
git add .claude-plugin/marketplace.json
git commit -m "chore: bump local-review to vx.y.z"
```

Then tag this repo:

```bash
cd /Users/spidey/code/review
git tag vx.y.z
```

### 6. Report

Output:

- Release version
- Number of changelog entries
- Files updated (CHANGELOG.md, plugin.json, marketplace.json)
- Tag name created
- Remind user to run `git push origin main --tags` in this repo and `git push` in the marketplace repo
