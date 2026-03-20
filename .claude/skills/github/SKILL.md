---
name: github
description: Use when working with GitHub — creating releases, managing issues, pull requests, checking CI status, uploading release assets, or any gh CLI operations. Triggers when user mentions "github release", "gh release", "upload to github", "create release", "github pages", "pull request", "gh pr", "github issue", or any GitHub repository management task.
---

# GitHub Operations

Guide for GitHub operations using the `gh` CLI for the local-review project.

## Repository

- **Remote**: `git@github.com:ugudlado/local-review.git`
- **CLI**: Always use `gh` (GitHub CLI) — never raw API calls

## Releases

### Create a release with assets

```bash
gh release create v<VERSION> \
  <asset-files...> \
  --title "v<VERSION>" \
  --notes "Release notes"
```

### Common release patterns

```bash
# From CHANGELOG content + .vsix asset
gh release create v1.3.0 \
  apps/vscode/local-review-vscode-1.3.0.vsix \
  --title "v1.3.0" \
  --notes-file CHANGELOG.md

# Auto-generate notes from commits since last tag
gh release create v1.3.0 \
  apps/vscode/local-review-vscode-1.3.0.vsix \
  --title "v1.3.0" \
  --generate-notes

# Draft release (not public)
gh release create v1.3.0 --draft \
  apps/vscode/local-review-vscode-1.3.0.vsix \
  --title "v1.3.0"

# Pre-release
gh release create v1.3.0-beta.1 --prerelease \
  apps/vscode/local-review-vscode-1.3.0.vsix \
  --title "v1.3.0-beta.1"
```

### Upload assets to existing release

```bash
gh release upload v1.3.0 apps/vscode/local-review-vscode-1.3.0.vsix
```

### List and view releases

```bash
gh release list
gh release view v1.3.0
```

### Delete a release

```bash
gh release delete v1.3.0 --yes
```

## Release Flags Reference

| Flag                | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `--draft`           | Create as draft (not visible publicly)              |
| `--prerelease`      | Mark as pre-release                                 |
| `--generate-notes`  | Auto-generate notes from commits since last tag     |
| `--notes "text"`    | Inline release notes                                |
| `--notes-file FILE` | Read release notes from a file                      |
| `--target BRANCH`   | Target branch (default: current)                    |
| `--latest`          | Mark as latest release (default for non-prerelease) |

## Pull Requests

```bash
# Create PR
gh pr create --title "Title" --body "Description"

# List open PRs
gh pr list

# View PR details
gh pr view <number>

# Check PR status (CI, reviews)
gh pr checks <number>

# Merge PR
gh pr merge <number> --merge  # or --squash, --rebase
```

## Issues

```bash
# Create issue
gh issue create --title "Title" --body "Description"

# List issues
gh issue list

# View issue
gh issue view <number>

# Close issue
gh issue close <number>
```

## Release Assets — What to Upload

For local-review releases, upload:

1. **VS Code extension**: `apps/vscode/local-review-vscode-<version>.vsix`

The plugin itself is installed via the Claude Code marketplace (not GitHub releases), so no plugin archive is needed.

## Gotchas

- **Tag must exist first**: `gh release create` creates the tag if it doesn't exist, but if you've already tagged (via `/release-prep`), it uses the existing tag.
- **Asset names**: GitHub uses the filename as the display name. Keep filenames descriptive (e.g., `local-review-vscode-1.3.0.vsix`).
- **Release notes from CHANGELOG**: When using `--notes-file CHANGELOG.md`, the entire file is used as the body. For a single version's notes, extract the relevant section first.
- **TLS errors**: If `gh` fails with TLS certificate errors, the user may need to check proxy/VPN settings or run `gh auth refresh`.
