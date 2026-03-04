# Spike Findings: @git-diff-view/react v0.0.40

## Summary

The library fully supports our use case. Both widget injection (for comment forms)
and persistent extend data (for existing comments) are first-class features with
clean React component APIs.

---

## 1. Widget API: React Component Injection

**Verdict: FULLY SUPPORTED**

Two complementary systems for injecting React components at specific lines:

### a) `renderWidgetLine` -- Interactive widgets (comment forms)

```tsx
<DiffView
  diffViewAddWidget={true} // enables "+" button on each line
  onAddWidgetClick={(lineNumber, side) => {
    /* track which line was clicked */
  }}
  renderWidgetLine={({ lineNumber, side, diffFile, onClose }) => (
    <CommentForm lineNumber={lineNumber} side={side} onClose={onClose} />
  )}
/>
```

- Triggered by clicking the "+" button on a line gutter
- `onClose` callback to programmatically dismiss the widget
- Returns `ReactNode` -- full React component support (state, hooks, etc.)
- Widget appears BELOW the clicked line, spanning the full width

### b) `renderExtendLine` + `extendData` -- Persistent data (existing comments)

```tsx
<DiffView
  extendData={{
    oldFile: { "5": { data: { comment: "fix this" } } },
    newFile: { "10": { data: { comment: "looks good" } } },
  }}
  renderExtendLine={({ lineNumber, side, data, diffFile, onUpdate }) => (
    <CommentThread comments={data} lineNumber={lineNumber} />
  )}
/>
```

- `extendData` maps line numbers (as strings) to arbitrary data objects
- `renderExtendLine` renders that data as a React component below the line
- `onUpdate` callback to trigger re-render when data changes
- Separate data for `oldFile` and `newFile` sides
- Generic type `<T>` flows through from `DiffViewProps<T>` to `data` param

### c) Programmatic widget control

```tsx
<DiffView
  onCreateUseWidgetHook={(hook) => {
    // hook is a Zustand-like store with:
    // - widgetSide: SplitSide
    // - widgetLineNumber: number
    // - setWidget({ side, lineNumber })
    widgetStoreRef.current = hook;
  }}
/>;

// Later: programmatically show widget on line 8
widgetStoreRef.current?.setWidget({ side: SplitSide.new, lineNumber: 8 });
```

---

## 2. Range Highlighting

**Verdict: NOT NATIVELY SUPPORTED as a prop**

The library handles diff-level highlighting automatically:

- Added lines (green background)
- Deleted lines (red background)
- Inline character-level changes (darker highlight within changed lines)

For custom range highlighting (e.g., "highlight lines 5-10 with a blue border"):

- **Approach**: Use CSS targeting the DOM structure. Lines are rendered with
  data attributes or predictable class names.
- **Alternative**: Use `extendData` to mark lines and apply custom styling
  in `renderExtendLine`.
- **CSS workaround**: The library renders lines in a virtual list. Each line
  row has identifiable structure we can target with CSS selectors.

---

## 3. Required Props (Minimum Viable)

```tsx
<DiffView
  data={{
    oldFile: { fileName: "file.ts", content: "old content" },
    newFile: { fileName: "file.ts", content: "new content" },
    hunks: ["@@ -1,5 +1,5 @@\n context\n-old line\n+new line\n context"],
  }}
/>
```

Minimum required: `data.hunks` (array of hunk strings from git diff output).
File names and content are optional but needed for syntax highlighting.

Alternative: Pass a pre-built `DiffFile` instance via `diffFile` prop instead
of raw `data`. This gives more control over initialization.

---

## 4. Dark Theme

```tsx
<DiffView diffViewTheme="dark" />
```

- Set via `diffViewTheme` prop: `"light" | "dark"`
- Must import CSS: `import "@git-diff-view/react/styles/diff-view.css"`
- Pure CSS variant available: `"@git-diff-view/react/styles/diff-view-pure.css"`
  (avoids Tailwind conflicts -- important since we use Tailwind)

---

## 5. View Modes

```tsx
import { DiffModeEnum } from "@git-diff-view/react";

DiffModeEnum.Split; // 3 - side-by-side (our default)
DiffModeEnum.Unified; // 4 - single column
DiffModeEnum.SplitGitHub; // 1 - GitHub-style split
DiffModeEnum.SplitGitLab; // 2 - GitLab-style split
```

---

## 6. Other Notable Features

| Feature             | Support | Notes                                     |
| ------------------- | ------- | ----------------------------------------- |
| Syntax highlighting | Yes     | Built-in via lowlight/highlight.js        |
| Line wrapping       | Yes     | `diffViewWrap` prop                       |
| Font size           | Yes     | `diffViewFontSize` prop                   |
| Hunk expansion      | Yes     | Collapsible context lines, expand up/down |
| Custom highlighter  | Yes     | `registerHighlighter` prop (shiki, etc.)  |
| Ref access          | Yes     | `ref` gives `getDiffFileInstance()`       |
| SSR/RSC             | Yes     | Per README                                |

---

## 7. Limitations Discovered

1. **No native line range highlighting** -- must use CSS or extendData workaround
2. **Hunk format**: Expects raw git diff hunk strings (starting with `@@`),
   not parsed objects. Our current diff parser produces parsed hunks, so we'll
   need to either:
   - Keep the raw hunk strings from git diff output, OR
   - Reconstruct hunk strings from our parsed format
3. **CSS conflicts**: Default CSS uses Tailwind utility classes. Use the
   `-pure.css` variant to avoid conflicts with our Tailwind setup.
4. **Bundle size**: Includes lowlight + highlight.js languages. May want to
   use the `registerHighlighter` prop with a lighter highlighter if bundle
   size is a concern.

---

## 8. Recommendations for T030/T031

1. **Use `renderExtendLine` + `extendData`** for existing review comment threads.
   Map our ReviewThread data to the extendData format keyed by line number.

2. **Use `renderWidgetLine` + `onAddWidgetClick`** for the "new comment" form.
   When user clicks "+", show a CommentForm component.

3. **Use `diff-view-pure.css`** to avoid Tailwind class conflicts.

4. **Store raw hunk strings** from the git diff output alongside our parsed
   data so we can pass them directly to the component.

5. **For range highlighting** (if needed), use CSS custom properties or
   class-based styling on the extendData mechanism.

6. **Consider `DiffModeEnum.SplitGitHub`** as the default mode since it
   most closely matches the GitHub PR review experience users expect.
