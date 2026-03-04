import React from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import type { DiffFile } from "../../utils/diffParser";
import type { Selection } from "../../utils/diffUtils";
import {
  lineKey,
  isLineInSelection,
  normalizeSelection,
  hunkDomId,
} from "../../utils/diffUtils";
import { ThreadCard } from "../review/ThreadCard";
import { ComposeBox } from "../review/ComposeBox";
import { HunkExpandRow } from "./HunkExpandRow";

interface DiffTableProps {
  selectedFile: DiffFile;
  threadsByKey: Map<string, ReviewThread[]>;
  outdatedThreadIds: Set<string>;
  showPendingOnly: boolean;
  dragSelection: Selection | null;
  composeSelection: Selection | null;
  composeDraft: string;
  replyDrafts: Record<string, string>;
  onReplyChange: (threadId: string, value: string) => void;
  onReply: (threadId: string) => void;
  onStatusChange: (threadId: string, status: ReviewThread["status"]) => void;
  onDraftChange: (value: string) => void;
  onSubmitCompose: () => void;
  onCancelCompose: () => void;
  onBeginSelection: (
    filePath: string,
    side: "old" | "new",
    line: number,
  ) => void;
  onDragUpdate: (filePath: string, side: "old" | "new", line: number) => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  expandedGaps: Map<string, Set<number>>;
  expansionContent: Map<string, string>;
  onExpandGap: (filePath: string, gapIndex: number) => void;
}

export function DiffTable({
  selectedFile,
  threadsByKey,
  outdatedThreadIds,
  showPendingOnly,
  dragSelection,
  composeSelection,
  composeDraft,
  replyDrafts,
  onReplyChange,
  onReply,
  onStatusChange,
  onDraftChange,
  onSubmitCompose,
  onCancelCompose,
  onBeginSelection,
  onDragUpdate,
  panelRef,
  expandedGaps,
  expansionContent,
  onExpandGap,
}: DiffTableProps) {
  return (
    <div className="flex min-h-0 flex-1">
      <div ref={panelRef} className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {selectedFile.hunks.map((hunk, hunkIndex) => {
              const rows = [];

              // Hunk header
              rows.push(
                <tr
                  key={`${selectedFile.path}-hunk-${hunkIndex}`}
                  id={hunkDomId(selectedFile.path, hunkIndex)}
                >
                  <td
                    colSpan={5}
                    className="bg-[var(--diff-hunk-bg)] py-1 pl-4 text-[11px] text-slate-500"
                  >
                    {hunk.header}
                  </td>
                </tr>,
              );

              for (let i = 0; i < hunk.lines.length; i++) {
                const line = hunk.lines[i];
                const targetSide: "old" | "new" | null =
                  line.newLineNumber !== null
                    ? "new"
                    : line.oldLineNumber !== null
                      ? "old"
                      : null;
                const targetLine =
                  targetSide === "old"
                    ? line.oldLineNumber
                    : line.newLineNumber;
                // When clicking on a context line immediately before added lines,
                // snap the comment anchor to the first added line so the thread
                // is associated with the actual change rather than the context.
                // Scan ahead past any intermediate context lines to find the next add.
                const nextAddedLine = (() => {
                  if (line.kind !== "context") return null;
                  for (let j = i + 1; j < hunk.lines.length; j++) {
                    if (hunk.lines[j].kind === "add")
                      return hunk.lines[j].newLineNumber;
                    if (hunk.lines[j].kind === "del") return null;
                  }
                  return null;
                })();
                const effectiveSide = nextAddedLine ? "new" : targetSide;
                const effectiveLine = nextAddedLine ?? targetLine;
                const key =
                  targetSide && targetLine
                    ? lineKey(selectedFile.path, targetLine, targetSide)
                    : "";
                const inlineThreads = (
                  key ? threadsByKey.get(key) || [] : []
                ).filter((t) => !outdatedThreadIds.has(t.id));
                const lineThreads = showPendingOnly
                  ? inlineThreads.filter((t) => t.status !== "approved")
                  : inlineThreads;

                const selected =
                  targetSide && targetLine
                    ? isLineInSelection(
                        dragSelection || composeSelection,
                        selectedFile.path,
                        targetSide,
                        targetLine,
                      )
                    : false;

                const composeAnchorLine = composeSelection
                  ? normalizeSelection(composeSelection).endLine
                  : null;
                const isComposerAnchor =
                  composeSelection &&
                  targetSide &&
                  targetLine &&
                  normalizeSelection(composeSelection).filePath ===
                    selectedFile.path &&
                  normalizeSelection(composeSelection).side === targetSide &&
                  composeAnchorLine === targetLine;

                let rowBg = "";
                if (line.kind === "add") rowBg = "bg-[var(--diff-added-bg)]";
                else if (line.kind === "del")
                  rowBg = "bg-[var(--diff-deleted-bg)]";
                else if (line.kind === "meta")
                  rowBg = "bg-[var(--diff-hunk-bg)]";

                let gutterBg = "";
                if (line.kind === "add")
                  gutterBg = "bg-[var(--diff-added-gutter)]";
                else if (line.kind === "del")
                  gutterBg = "bg-[var(--diff-deleted-gutter)]";
                else if (line.kind === "meta")
                  gutterBg = "bg-[var(--diff-hunk-gutter)]";
                else gutterBg = "bg-[var(--bg-base)]";

                const selectionHighlight = selected
                  ? "ring-1 ring-inset ring-blue-500/50 bg-blue-900/20"
                  : "";

                rows.push(
                  <tr
                    key={`${selectedFile.path}-${hunkIndex}-${i}`}
                    className={`group border-b border-[var(--bg-elevated)] ${rowBg} ${selectionHighlight}`}
                    onMouseEnter={() => {
                      if (!dragSelection || !targetSide || !targetLine) return;
                      if (
                        dragSelection.filePath !== selectedFile.path ||
                        dragSelection.side !== targetSide
                      )
                        return;
                      onDragUpdate(selectedFile.path, targetSide, targetLine);
                    }}
                  >
                    {/* Add-comment button */}
                    <td
                      className={`w-6 border-r border-[var(--bg-elevated)] text-center align-top ${gutterBg}`}
                    >
                      {targetSide && targetLine ? (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onBeginSelection(
                              selectedFile.path,
                              effectiveSide ?? "new",
                              effectiveLine ?? 1,
                            );
                          }}
                          className="h-full w-full text-slate-700 opacity-0 transition hover:text-[var(--accent-blue)] group-hover:opacity-100"
                          title="Add comment (drag for range)"
                        >
                          +
                        </button>
                      ) : null}
                    </td>
                    {/* Old line number */}
                    <td
                      className={`w-12 select-none border-r border-[var(--bg-elevated)] px-2 py-0.5 text-right text-[10px] text-slate-600 ${gutterBg}`}
                    >
                      {line.oldLineNumber ?? ""}
                    </td>
                    {/* New line number */}
                    <td
                      className={`w-12 select-none border-r border-[var(--bg-elevated)] px-2 py-0.5 text-right text-[10px] text-slate-600 ${gutterBg}`}
                    >
                      {line.newLineNumber ?? ""}
                    </td>
                    {/* Change marker */}
                    <td
                      className={`w-5 select-none px-1 py-0.5 text-center ${line.kind === "add" ? "text-emerald-400" : line.kind === "del" ? "text-rose-400" : "text-slate-700"}`}
                    >
                      {line.kind === "add"
                        ? "+"
                        : line.kind === "del"
                          ? "-"
                          : ""}
                    </td>
                    {/* Line content — spans the rest */}
                    <td className="py-0.5 pl-2 pr-4 text-slate-300">
                      <pre className="whitespace-pre-wrap break-all">
                        {line.content}
                      </pre>

                      {/* Threads anchored to this line */}
                      <div
                        id={
                          key
                            ? `thread-anchor-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`
                            : undefined
                        }
                      >
                        {lineThreads.map((thread) => (
                          <ThreadCard
                            key={thread.id}
                            thread={thread}
                            replyDraft={replyDrafts[thread.id] || ""}
                            onReplyChange={(value) =>
                              onReplyChange(thread.id, value)
                            }
                            onReply={() => onReply(thread.id)}
                            onStatusChange={(status) =>
                              onStatusChange(thread.id, status)
                            }
                          />
                        ))}
                      </div>

                      {/* Compose box */}
                      {isComposerAnchor && composeSelection ? (
                        <ComposeBox
                          selection={normalizeSelection(composeSelection)}
                          draft={composeDraft}
                          onDraftChange={onDraftChange}
                          onSubmit={onSubmitCompose}
                          onCancel={onCancelCompose}
                        />
                      ) : null}
                    </td>
                  </tr>,
                );
              }

              // Expand row between this hunk and the next
              if (hunkIndex < selectedFile.hunks.length - 1) {
                const nextHunk = selectedFile.hunks[hunkIndex + 1];

                const lastLine = [...hunk.lines]
                  .reverse()
                  .find((l) => l.newLineNumber !== null);
                const lastNewLine = lastLine?.newLineNumber ?? 0;

                const nextFirstLine = nextHunk.lines.find(
                  (l) => l.newLineNumber !== null,
                );
                const nextStart = nextFirstLine?.newLineNumber ?? 0;

                const gap = nextStart - lastNewLine - 1;
                const isExpanded =
                  expandedGaps.get(selectedFile.path)?.has(hunkIndex) ?? false;

                if (gap > 0 && !isExpanded) {
                  rows.push(
                    <HunkExpandRow
                      key={`gap-${selectedFile.path}-${hunkIndex}`}
                      gapLines={gap}
                      onExpand={() => onExpandGap(selectedFile.path, hunkIndex)}
                    />,
                  );
                } else if (isExpanded) {
                  const fileLines = (
                    expansionContent.get(selectedFile.path) || ""
                  ).split("\n");
                  for (let ln = lastNewLine + 1; ln < nextStart; ln++) {
                    const content = fileLines[ln - 1] ?? "";
                    rows.push(
                      <tr
                        key={`expand-${selectedFile.path}-${hunkIndex}-${ln}`}
                        className="bg-[var(--bg-base)]"
                      >
                        <td className="w-6 border-r border-[var(--bg-elevated)] bg-[var(--bg-base)]" />
                        <td className="w-12 select-none border-r border-[var(--bg-elevated)] bg-[var(--bg-base)] px-2 py-0.5 text-right text-[10px] text-slate-600">
                          {ln}
                        </td>
                        <td className="w-12 select-none border-r border-[var(--bg-elevated)] bg-[var(--bg-base)] px-2 py-0.5 text-right text-[10px] text-slate-600">
                          {ln}
                        </td>
                        <td className="w-5 select-none bg-[var(--bg-base)] px-1 py-0.5" />
                        <td className="py-0.5 pl-2 pr-4 text-slate-500">
                          <pre className="whitespace-pre-wrap break-all">
                            {content}
                          </pre>
                        </td>
                      </tr>,
                    );
                  }
                }
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>

      {/* Hunk minimap */}
      <div className="flex w-12 shrink-0 flex-col border-l border-[var(--border-default)] bg-[var(--bg-surface)] py-2">
        <div className="mb-2 text-center text-[9px] font-semibold uppercase tracking-wider text-slate-700">
          hunks
        </div>
        <div className="flex flex-col items-center gap-1.5 overflow-auto">
          {selectedFile.hunks.map((hunk, index) => {
            let changed = 0;
            for (const line of hunk.lines)
              if (line.kind === "add" || line.kind === "del") changed += 1;
            return (
              <button
                key={`${selectedFile.path}-mini-${index}`}
                type="button"
                onClick={() => {
                  document
                    .getElementById(hunkDomId(selectedFile.path, index))
                    ?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
                className="flex w-9 flex-col items-center rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] py-1.5 text-[9px] text-slate-500 hover:bg-[var(--border-default)] hover:text-slate-300"
                title={hunk.header}
              >
                <span>{index + 1}</span>
                <div className="mt-1 h-1 w-6 rounded-full bg-[var(--border-default)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-blue)]"
                    style={{ width: `${Math.min(100, (changed / 12) * 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
