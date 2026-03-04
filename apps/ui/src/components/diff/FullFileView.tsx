import React from "react";
import type { ReviewThread } from "../../services/localReviewApi";
import type { DiffFile } from "../../utils/diffParser";
import type { Selection } from "../../utils/diffUtils";
import {
  lineKey,
  isLineInSelection,
  normalizeSelection,
} from "../../utils/diffUtils";
import { ThreadCard } from "../review/ThreadCard";
import { ComposeBox } from "../review/ComposeBox";

interface FullFileViewProps {
  fullFileLoading: boolean;
  fullFileError: boolean;
  fullFileContent: string | null;
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
}

export function FullFileView({
  fullFileLoading,
  fullFileError,
  fullFileContent,
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
}: FullFileViewProps) {
  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 overflow-auto">
      {fullFileLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
          Loading…
        </div>
      ) : fullFileError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
          Could not load file
        </div>
      ) : fullFileContent === null ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
          Loading…
        </div>
      ) : (
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {fullFileContent.split("\n").map((lineContent, idx) => {
              const lineNum = idx + 1;
              const key = lineKey(selectedFile.path, lineNum, "new");
              const allLineThreads = (threadsByKey.get(key) || []).filter(
                (t) => !outdatedThreadIds.has(t.id),
              );
              const lineThreads = showPendingOnly
                ? allLineThreads.filter((t) => t.status !== "approved")
                : allLineThreads;
              const selected = isLineInSelection(
                dragSelection || composeSelection,
                selectedFile.path,
                "new",
                lineNum,
              );
              const composeAnchorLine = composeSelection
                ? normalizeSelection(composeSelection).endLine
                : null;
              const isComposerAnchor =
                composeSelection &&
                normalizeSelection(composeSelection).filePath ===
                  selectedFile.path &&
                normalizeSelection(composeSelection).side === "new" &&
                composeAnchorLine === lineNum;
              return (
                <tr
                  key={lineNum}
                  className={`group border-b border-[var(--bg-elevated)] ${selected ? "bg-blue-900/20 ring-1 ring-inset ring-blue-500/50" : ""}`}
                  onMouseEnter={() => {
                    if (!dragSelection) return;
                    if (
                      dragSelection.filePath !== selectedFile.path ||
                      dragSelection.side !== "new"
                    )
                      return;
                    onDragUpdate(selectedFile.path, "new", lineNum);
                  }}
                >
                  <td className="w-6 border-r border-[var(--bg-elevated)] bg-[var(--bg-base)] text-center align-top">
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onBeginSelection(selectedFile.path, "new", lineNum);
                      }}
                      className="h-full w-full text-slate-700 opacity-0 transition hover:text-[var(--accent-blue)] group-hover:opacity-100"
                      title="Add comment (drag for range)"
                    >
                      +
                    </button>
                  </td>
                  <td className="w-12 select-none border-r border-[var(--bg-elevated)] bg-[var(--bg-base)] px-2 py-0.5 text-right text-[10px] text-slate-600">
                    {lineNum}
                  </td>
                  <td className="py-0.5 pl-2 pr-4 text-slate-300">
                    <pre className="whitespace-pre-wrap break-all">
                      {lineContent}
                    </pre>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
