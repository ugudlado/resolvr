---
mode: non-tdd
feature-id: 2026-03-12-openspec-dev-workflow
linear-ticket: none
---

# Specification: Enable Dev Workflow & OpenSpec Artifact Review

## Overview

Enable the full development workflow in the local-review app by flipping the `DEV_WORKFLOW` feature flag, removing the dedicated Spec tab, and switching all artifact path resolution from the legacy `specs/active/` convention to `openspec/changes/`. OpenSpec artifacts become reviewable through the existing code diff view.

## Requirements

### Functional

1. **FR-1**: `FLAGS.DEV_WORKFLOW` must be `true` by default, enabling Dashboard, feature nav, and Tasks tab
2. **FR-2**: The Spec tab must be removed from routing and navigation — only Tasks and Code tabs remain
3. **FR-3**: Feature discovery must find features with `openspec/changes/{featureId}/` artifacts in worktrees
4. **FR-4**: Task progress must be parsed from `openspec/changes/{featureId}/tasks.md` using the OpenSpec task format (`## Phase` headings, `T-N` task IDs, `- [x] T-1 description` syntax)
5. **FR-5**: The Code tab must show all changed files including openspec/ artifacts as part of the normal git diff
6. **FR-6**: OpenSpec artifacts must be annotatable using the existing code review thread system
7. **FR-7**: Feature status derivation must work without a separate spec review session
8. **FR-8**: Archived features at `specs/archived/` must remain discoverable (backward compat)
9. **FR-9**: All UI references to the `/spec` route must be updated — status defaults, dashboard quick links, and feature redirect logic must point to `/code` instead of `/spec`

### Non-Functional

1. **NF-1**: No new API endpoints required — existing diff and file endpoints are sufficient
2. **NF-2**: No new UI components required — existing diff view handles markdown files
3. **NF-3**: Dead code from SpecReviewPage may be left for a follow-up cleanup

## Architecture

### Server Changes

```
apps/server/src/
├── routes/
│   ├── features.ts   ← switch spec/tasks path resolution to openspec/changes/
│   ├── tasks.ts      ← switch tasks.md path + parser to openspec/changes/ format
│   └── spec.ts       ← keep for backward compat but unused by new flow
└── utils.ts          ← findWorktreePath unchanged
```

### UI Changes

```
apps/ui/src/
├── config/app.ts                        ← FLAGS.DEV_WORKFLOW = true
├── App.tsx                              ← remove SpecReviewPage route, fix default redirect
├── components/
│   ├── FeatureNavBar.tsx                ← remove "Spec" from tabs array
│   └── dashboard/FeatureCard.tsx        ← update quick action links (spec → code)
├── utils/featureStatus.ts               ← change defaultTab from "spec" to "code" for design states
├── types/constants.ts                   ← remove FEATURE_TAB.Spec (or keep for compat)
└── pages/
    └── SpecReviewPage.tsx               ← unused (cleanup in follow-up)
```

### Data Flow

```
Feature worktree on disk
  └── openspec/changes/{featureId}/
       ├── proposal.md
       ├── spec.md
       ├── design.md
       └── tasks.md
            │
            ├──[git diff main...feature]──▶ Code tab (all files including openspec/)
            │                                 └── annotations via code review session
            │
            └──[fs.readFile + parse]──▶ Tasks tab (checkbox progress)
```

## Acceptance Criteria

1. **AC-1**: Given a feature with openspec artifacts, when I open the Code tab, then proposal.md, spec.md, and design.md appear in the file sidebar
2. **AC-2**: Given a feature with openspec artifacts, when I click on proposal.md in the sidebar, then the full file content is displayed and I can add annotation threads
3. **AC-3**: Given a feature with openspec/changes/{id}/tasks.md, when I open the Tasks tab, then task progress is correctly displayed
4. **AC-4**: Given the app loads at `/`, then the Dashboard is displayed (not standalone review)
5. **AC-5**: Given a feature, when I view the nav bar, then only Tasks and Code tabs are shown (no Spec tab)
6. **AC-6**: Given an archived feature at specs/archived/, when I view the Dashboard, then it still appears as a completed feature
7. **AC-7**: Given a feature in "design" or "design_review" status, when clicking from the Dashboard, then the user lands on the Code tab (not a dead `/spec` route)
8. **AC-8**: Given an openspec tasks.md with `## Phase` headings and `T-N` task IDs, the Tasks tab correctly parses all tasks and their statuses

## Decisions

1. **No separate spec viewer** — The code diff view already renders markdown files with line numbers, syntax highlighting, and annotation support. At design review time, all openspec files are new additions and naturally show as full content in the diff.

2. **Non-TDD mode** — This is primarily a configuration/routing change with minimal new logic. The changes are straightforward flag flips and path string updates.

3. **Keep spec.ts routes** — Rather than removing the spec API routes immediately, leave them for a follow-up cleanup. This avoids breaking anything that might reference them.

4. **Single code session for all annotations** — OpenSpec artifact annotations live in the same `{featureId}-code.json` session as code annotations. Thread anchors already contain file paths, so `openspec/changes/{id}/spec.md` annotations are naturally separate from `src/foo.ts` annotations.

5. **Feature status without spec session** — With the Spec tab removed, `deriveFeatureStatus()` should be updated: if a feature has openspec artifacts but no code session, status is "design" (ready for design review via Code tab). The spec session verdict is no longer relevant.

## Review Summary

Artifacts reviewed by Claude architecture agent and Codex code reviewer. All critical findings addressed in revision 2.

| #   | Finding                                                                   | Severity   | Source                | Resolution                        |
| --- | ------------------------------------------------------------------------- | ---------- | --------------------- | --------------------------------- |
| C-1 | Task parser expects `### Phase` + `TN:`, OpenSpec uses `## Phase` + `T-N` | critical   | [codex] [claude-arch] | Added T-5, T-6 for parser fixes   |
| C-2 | Archived tasks.md path doubles featureId                                  | critical   | [claude-arch]         | Added T-7 to fix pre-existing bug |
| C-3 | `FeatureDefaultRedirect` fallback points to removed `/spec` route         | critical   | [codex] [claude-arch] | Specified in T-13                 |
| C-4 | `featureStatus.ts` defaultTab "spec" missing from task list               | critical   | [codex] [claude-arch] | Added T-14                        |
| S-1 | `hasSpec` should check all openspec artifacts, not just spec.md           | suggestion | [codex]               | Covered by T-2                    |
| S-2 | `getLastActivity` missing proposal.md and design.md                       | suggestion | [claude-arch]         | Added T-4                         |
| S-3 | `FeatureNavBar` `defaultFallbackTab` hardcodes "spec"                     | suggestion | [claude-arch]         | Added T-12                        |
| S-5 | Feature switcher preserves stale "spec" tab across navigation             | suggestion | [claude-arch]         | Addressed by T-12 (fallback fix)  |
| N-4 | `pnpm knip` will fail with dead SpecReviewPage code                       | nitpick    | [claude-arch]         | Added T-16 for knip cleanup       |
