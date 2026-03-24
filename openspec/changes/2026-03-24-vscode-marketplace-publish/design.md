# Design: Publish VS Code Extension to Marketplace

## Approach

This is a process and documentation change. No extension code changes are needed. The work consists of: (1) one-time publisher setup, (2) adding a publish step to `release-prep.md`, and (3) updating README install instructions.

## One-Time Setup (Manual, Pre-Implementation)

These steps must be completed by the maintainer before the first publish:

### 1. Create Azure DevOps Organization

1. Go to https://dev.azure.com
2. Sign in with a Microsoft account (or create one)
3. Create an organization if one does not already exist

### 2. Create a Personal Access Token (PAT)

1. In Azure DevOps, go to User Settings (top-right icon) > Personal Access Tokens
2. Click "New Token"
3. Set name: `vsce-local-review`
4. Set organization: "All accessible organizations"
5. Set expiration: 1 year (maximum)
6. Set scopes: select "Custom defined", then check **Marketplace > Manage**
7. Click Create and copy the token immediately
8. Store the PAT locally:
   ```bash
   # Add to ~/.zshrc or equivalent
   export VSCE_PAT="<token>"
   ```

### 3. Create and Register Publisher

1. Go to https://marketplace.visualstudio.com/manage
2. Click **Create publisher**
3. Enter publisher name: `local-review` (or an alternative if claimed — see note below)
4. Complete the form and save

Then authenticate the CLI:

```bash
cd apps/vscode
pnpm exec vsce login local-review
# Paste the PAT when prompted
```

If `local-review` is already claimed, choose an alternative (e.g., `ugudlado`) and update `apps/vscode/package.json`:

```json
"publisher": "ugudlado"
```

Then the full extension ID becomes `ugudlado.local-review-vscode` and all references must be updated accordingly.

### 4. First Publish

```bash
cd apps/vscode
pnpm exec vsce publish --pat "$VSCE_PAT" --packagePath local-review-vscode-$(node -p "require('./package.json').version").vsix
```

The `--packagePath` flag publishes the prebuilt `.vsix` produced in the preceding package step rather than rebuilding from source. This ensures the Marketplace artifact is identical to the GitHub release asset.

## File Changes

### 1. `.claude/commands/release-prep.md`

Add a new step **8. Publish to VS Code Marketplace** between the current step 7 (Commit and Tag) and step 8 (Push and Create GitHub Release). The current steps 8 and 9 become steps 9 and 10.

New step 8 content:

```markdown
### 8. Publish to VS Code Marketplace

Publish the extension to the VS Code Marketplace using the PAT:

\`\`\`bash
VSIX_PATH="local-review-vscode-$(node -p "require('./package.json').version").vsix"
pnpm exec vsce publish --pat "$VSCE_PAT" --packagePath "$VSIX_PATH"
\`\`\`

The `--packagePath` flag publishes the prebuilt `.vsix` from step 6 (identical to the GitHub release asset), avoiding any artifact drift between Marketplace and GitHub distributions.

If `VSCE_PAT` is not set or the publish fails:

- **PAT not set**: Warn the user that `VSCE_PAT` environment variable is required. Skip this step but continue with the GitHub release. The extension can be published manually later with the same command.
- **PAT expired**: Direct the user to regenerate at https://dev.azure.com > User Settings > Personal Access Tokens. Skip this step but continue with the GitHub release.
- **Network error**: Retry once. If still failing, skip and continue.
- **Version already published**: Non-fatal — GitHub release still has the `.vsix`. Do not retry.
```

Update step 9 (formerly step 8) -- no changes to Push and Create GitHub Release content, only renumber.

Update step 10 (formerly step 9) -- Report section. Add to the output list:

```markdown
- VS Code Marketplace publish status (published / skipped with reason)
- Remind user to verify at https://marketplace.visualstudio.com/items?itemName=<publisher>.local-review-vscode
```

Remove from the Report section:

```markdown
- Remind user to:
  - Install the `.vsix` via `code --install-extension apps/vscode/local-review-vscode-x.y.z.vsix`
```

Replace with:

```markdown
- Remind user to:
  - Install via marketplace: `code --install-extension <publisher>.local-review-vscode`
  - Or install from `.vsix`: `code --install-extension apps/vscode/local-review-vscode-x.y.z.vsix`
```

### 2. `README.md`

Replace the current VS Code extension install block (lines 66-69):

```markdown
Install the `.vsix` from the [latest release](https://github.com/ugudlado/local-review/releases):

\`\`\`bash
code --install-extension local-review-vscode-<version>.vsix
\`\`\`
```

With:

```markdown
Install from the VS Code Marketplace:

\`\`\`bash
code --install-extension <publisher>.local-review-vscode
\`\`\`

Or install manually from the [latest release](https://github.com/ugudlado/local-review/releases):

\`\`\`bash
code --install-extension local-review-vscode-<version>.vsix
\`\`\`
```

### 3. `apps/vscode/package.json` (conditional)

Only if `local-review` publisher ID is unavailable:

- Change `"publisher"` field to the chosen alternative
- Update all references in README and release-prep accordingly

No other fields need to change. The `repository`, `icon`, `license`, and `homepage` fields are not required for marketplace publishing but are recommended. If the maintainer wants a polished marketplace listing, these can be added later (out of scope for this change).

## Error Handling / Failure Modes

| Failure                   | Impact                                | Mitigation                                                                                                                                       |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VSCE_PAT` not set        | `vsce publish` fails immediately      | release-prep checks for the env var, warns, and skips the publish step. GitHub release proceeds normally.                                        |
| PAT expired               | Auth error from marketplace API       | release-prep prints the regeneration URL and skips. Extension can be published manually after PAT renewal.                                       |
| Publisher ID claimed      | First publish fails                   | Detected during one-time setup, not during release. Fallback: use `ugudlado` as publisher.                                                       |
| Network failure           | Publish times out                     | Retry once. If still failing, skip and note in report. The `.vsix` is still attached to the GitHub release.                                      |
| Version already published | Marketplace rejects duplicate version | This should not happen if release-prep is the sole publish path. If it does, the error is non-fatal -- the GitHub release still has the `.vsix`. |

Key design principle: The marketplace publish step is **non-blocking**. A publish failure never prevents the GitHub release from being created. The `.vsix` on GitHub remains the fallback install path.

## What Does Not Change

- Extension source code (`apps/vscode/src/`)
- Extension build process (`esbuild` bundling)
- `.vsix` packaging step in release-prep
- GitHub release `.vsix` asset attachment
- SessionStart hook behavior
- Any other release-prep steps (changelog, version bumps, commit, tag, push)
