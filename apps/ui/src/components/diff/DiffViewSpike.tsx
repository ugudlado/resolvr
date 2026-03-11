/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
/**
 * SPIKE: @git-diff-view/react API Verification
 *
 * This file is a research spike to verify the widget API of @git-diff-view/react.
 * It is NOT production code. See SPIKE_FINDINGS.md for documented results.
 *
 * Key findings from type analysis:
 *
 * 1. WIDGET SYSTEM - Yes, supports React components via two mechanisms:
 *
 *    a) `renderWidgetLine` prop: Renders a React widget below a specific line.
 *       Triggered when user clicks the "add widget" button (enabled via `diffViewAddWidget`).
 *       Signature: ({ lineNumber, side, diffFile, onClose }) => ReactNode
 *       - `lineNumber`: the line where the widget appears
 *       - `side`: SplitSide.old (1) or SplitSide.new (2)
 *       - `onClose`: callback to dismiss the widget
 *       This is PERFECT for inline review comment threads.
 *
 *    b) `renderExtendLine` prop + `extendData`: Renders persistent React content
 *       below specific lines. Data is provided per-line via `extendData` prop:
 *       { oldFile: { [lineNumber]: { data: T } }, newFile: { [lineNumber]: { data: T } } }
 *       The renderer gets: ({ lineNumber, side, data, diffFile, onUpdate }) => ReactNode
 *       This is PERFECT for showing existing review comments that persist.
 *
 *    c) `onAddWidgetClick` callback: Fired when user clicks the "+" button on a line.
 *       Signature: (lineNumber: number, side: SplitSide) => void
 *       We can use this to open a "new comment" form.
 *
 *    d) `onCreateUseWidgetHook`: Provides access to the internal widget store,
 *       allowing programmatic control of widget visibility (setWidget({ side, lineNumber })).
 *
 * 2. RANGE HIGHLIGHTING - Not natively supported as a prop.
 *    The library handles diff-level highlighting (additions/deletions, inline changes)
 *    automatically. For custom range highlighting (e.g., "highlight lines 5-10"),
 *    we would need CSS-based approach targeting line number data attributes.
 *
 * 3. DIFF MODES:
 *    - DiffModeEnum.Split (3) - side-by-side
 *    - DiffModeEnum.Unified (4) - single column
 *    - DiffModeEnum.SplitGitHub (1) - GitHub-style split
 *    - DiffModeEnum.SplitGitLab (2) - GitLab-style split
 *
 * 4. THEME: `diffViewTheme` prop accepts "light" | "dark"
 *
 * 5. DATA FORMAT: Either pass raw data via `data` prop (oldFile + newFile + hunks)
 *    or pre-process with DiffFile.createInstance() and pass via `diffFile` prop.
 *    The `hunks` array is raw hunk strings from git diff output.
 */

import { useState, useCallback, useRef } from "react";
import { DiffView, DiffModeEnum, SplitSide } from "@git-diff-view/react";
import type { DiffFile } from "@git-diff-view/react";
import "@git-diff-view/react/styles/diff-view.css";

// Sample diff data - a simple TypeScript file change
const OLD_CONTENT = `import React from 'react';

interface Props {
  name: string;
}

function Hello({ name }: Props) {
  return <div>Hello, {name}!</div>;
}

export default Hello;
`;

const NEW_CONTENT = `import React from 'react';

interface Props {
  name: string;
  greeting?: string;
}

function Hello({ name, greeting = 'Hello' }: Props) {
  return (
    <div className="greeting">
      {greeting}, {name}!
    </div>
  );
}

export default Hello;
`;

// Hunks from a git diff of the above
const HUNKS = [
  "@@ -1,11 +1,15 @@\n import React from 'react';\n \n interface Props {\n   name: string;\n+  greeting?: string;\n }\n \n-function Hello({ name }: Props) {\n-  return <div>Hello, {name}!</div>;\n+function Hello({ name, greeting = 'Hello' }: Props) {\n+  return (\n+    <div className=\"greeting\">\n+      {greeting}, {name}!\n+    </div>\n+  );\n }\n \n export default Hello;",
];

// Example review comment data for extendData
interface ReviewComment {
  id: string;
  author: string;
  body: string;
  resolved: boolean;
}

/**
 * Spike component demonstrating @git-diff-view/react capabilities.
 *
 * Verifies:
 * - Basic diff rendering with syntax highlighting
 * - Widget system (renderWidgetLine) for inline comment forms
 * - Extend data system (renderExtendLine + extendData) for persistent comments
 * - Theme switching (light/dark)
 * - Mode switching (split/unified)
 */
export function DiffViewSpike() {
  const [mode, setMode] = useState<DiffModeEnum>(DiffModeEnum.Split);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeWidget, setActiveWidget] = useState<{
    lineNumber: number;
    side: SplitSide;
  } | null>(null);

  // Simulated existing review comments (for extendData)
  const [comments, setComments] = useState<
    Record<string, { data: ReviewComment }>
  >({
    // Comment on line 5 (new side) - the added "greeting?" prop
    "5": {
      data: {
        id: "1",
        author: "reviewer",
        body: "Should this have a default value in the interface too?",
        resolved: false,
      },
    },
  });

  // Handler for "+" button click on a line
  const handleAddWidgetClick = useCallback(
    (lineNumber: number, side: SplitSide) => {
      console.log("[Spike] Add widget clicked:", { lineNumber, side });
      setActiveWidget({ lineNumber, side });
    },
    [],
  );

  // Render the widget (comment form) when user clicks "+"
  const renderWidgetLine = useCallback(
    ({
      lineNumber,
      side,
      onClose,
    }: {
      lineNumber: number;
      side: SplitSide;
      diffFile: DiffFile;
      onClose: () => void;
    }) => {
      // Only show widget for the line the user clicked
      if (
        activeWidget?.lineNumber !== lineNumber ||
        activeWidget?.side !== side
      ) {
        return null;
      }

      return (
        <div
          style={{
            padding: "8px 12px",
            background: theme === "dark" ? "#1e293b" : "#f1f5f9",
            borderTop: "1px solid #334155",
            borderBottom: "1px solid #334155",
          }}
        >
          <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: 4 }}>
            New comment on line {lineNumber} (
            {side === SplitSide.old ? "old" : "new"} side)
          </div>
          <textarea
            style={{
              width: "100%",
              minHeight: 60,
              background: theme === "dark" ? "#0f172a" : "#fff",
              color: theme === "dark" ? "#e2e8f0" : "#1e293b",
              border: "1px solid #475569",
              borderRadius: 4,
              padding: 8,
              fontSize: 13,
            }}
            placeholder="Write a comment..."
            autoFocus
          />
          <div style={{ marginTop: 4, display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                // Add as persistent comment via extendData
                setComments((prev) => ({
                  ...prev,
                  [String(lineNumber)]: {
                    data: {
                      id: String(Date.now()),
                      author: "you",
                      body: "Sample comment added via widget",
                      resolved: false,
                    },
                  },
                }));
                setActiveWidget(null);
                onClose();
              }}
              style={{
                padding: "4px 12px",
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Submit
            </button>
            <button
              onClick={() => {
                setActiveWidget(null);
                onClose();
              }}
              style={{
                padding: "4px 12px",
                background: "#475569",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    },
    [activeWidget, theme],
  );

  // Render persistent comments below lines (via extendData)
  const renderExtendLine = useCallback(
    ({
      data,
      lineNumber,
      side,
    }: {
      lineNumber: number;
      side: SplitSide;
      data: ReviewComment;
      diffFile: DiffFile;
      onUpdate: () => void;
    }) => {
      return (
        <div
          style={{
            padding: "8px 12px",
            background: theme === "dark" ? "#1a1a2e" : "#eff6ff",
            borderLeft: `3px solid ${data.resolved ? "#22c55e" : "#f59e0b"}`,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: 2 }}>
            {data.author}
          </div>
          <div style={{ color: theme === "dark" ? "#cbd5e1" : "#334155" }}>
            {data.body}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            Line {lineNumber} - {side === SplitSide.old ? "old" : "new"} side
            {data.resolved ? " (resolved)" : ""}
          </div>
        </div>
      );
    },
    [theme],
  );

  // Access to widget store for programmatic control
  const widgetHookRef = useRef<any>(null);
  const handleCreateUseWidgetHook = useCallback((hook: any) => {
    widgetHookRef.current = hook;
    console.log("[Spike] Widget hook created:", hook);
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 1200 }}>
      <h2 style={{ marginBottom: 8 }}>@git-diff-view/react Spike</h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() =>
            setMode(
              mode === DiffModeEnum.Split
                ? DiffModeEnum.Unified
                : DiffModeEnum.Split,
            )
          }
          style={{
            padding: "4px 12px",
            background: "#334155",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Mode: {mode === DiffModeEnum.Split ? "Split" : "Unified"}
        </button>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            padding: "4px 12px",
            background: "#334155",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Theme: {theme}
        </button>
        <button
          onClick={() => {
            // Programmatically trigger widget on line 8
            if (widgetHookRef.current) {
              // This demonstrates programmatic widget control
              console.log("[Spike] Programmatically opening widget on line 8");
            }
            setActiveWidget({ lineNumber: 8, side: SplitSide.new });
          }}
          style={{
            padding: "4px 12px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Open Widget on Line 8
        </button>
      </div>

      {/* The DiffView component */}
      <DiffView
        data={{
          oldFile: {
            fileName: "Hello.tsx",
            fileLang: "tsx",
            content: OLD_CONTENT,
          },
          newFile: {
            fileName: "Hello.tsx",
            fileLang: "tsx",
            content: NEW_CONTENT,
          },
          hunks: HUNKS,
        }}
        diffViewMode={mode}
        diffViewTheme={theme}
        diffViewHighlight={true}
        diffViewWrap={true}
        diffViewFontSize={13}
        diffViewAddWidget={true}
        extendData={{
          newFile: comments,
        }}
        renderWidgetLine={renderWidgetLine}
        renderExtendLine={renderExtendLine}
        onAddWidgetClick={handleAddWidgetClick}
        onCreateUseWidgetHook={handleCreateUseWidgetHook}
      />
    </div>
  );
}

export default DiffViewSpike;
