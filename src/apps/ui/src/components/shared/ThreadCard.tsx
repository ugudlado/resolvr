import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ReviewMessage,
  ReviewThread,
  ThreadAnchor,
  ThreadSeverity,
} from "../../types/sessions";

// ---------------------------------------------------------------------------
// Anchor label helper
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable label for a thread anchor.
 *
 * - Spec anchors: section path + truncated preview
 *   e.g. "Architecture.Components - Unified session model..."
 * - Diff anchors: file path + line range
 *   e.g. "src/utils/parse.ts L12-L18"
 */
export function anchorLabel(anchor: ThreadAnchor): string {
  if (anchor.type === "diff-line") {
    const range =
      anchor.lineEnd && anchor.lineEnd !== anchor.line
        ? `L${anchor.line}-L${anchor.lineEnd}`
        : `L${anchor.line}`;
    return `${anchor.path} ${range}`;
  }
  // Spec block anchor
  const preview =
    anchor.preview.length > 60
      ? anchor.preview.slice(0, 57) + "..."
      : anchor.preview;
  return anchor.path ? `${anchor.path} - ${preview}` : preview;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: ReviewThread["status"] }) {
  const colors: Record<ReviewThread["status"], string> = {
    open: "bg-amber-400",
    resolved: "bg-indigo-400",
    approved: "bg-emerald-400",
  };
  return (
    <span
      aria-live="polite"
      aria-label={status}
      className={`inline-block h-2 w-2 rounded-full ${colors[status]}`}
    />
  );
}

function StatusLabel({ status }: { status: ReviewThread["status"] }) {
  const styles: Record<ReviewThread["status"], string> = {
    open: "text-amber-400",
    resolved: "text-indigo-400",
    approved: "text-emerald-400",
  };
  return (
    <span
      aria-live="polite"
      className={`text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

const severityConfig: Record<
  ThreadSeverity,
  { bg: string; text: string; dot: string }
> = {
  blocking: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
  },
  suggestion: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  nitpick: {
    bg: "bg-[var(--bg-overlay)]",
    text: "text-[var(--text-tertiary)]",
    dot: "bg-[var(--text-tertiary)]",
  },
};

function SeverityBadge({ severity }: { severity?: ThreadSeverity }) {
  if (!severity) return null;
  const cfg = severityConfig[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1 w-1 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
}

function AuthorAvatar({
  authorType,
  author,
}: {
  authorType: ReviewMessage["authorType"];
  author: string;
}) {
  if (authorType === "agent") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-[10px] font-bold text-indigo-400">
        AI
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bg-overlay)] text-[10px] font-bold text-[var(--text-secondary)]">
      {author.slice(0, 2).toUpperCase()}
    </div>
  );
}

function MessageItem({ message }: { message: ReviewMessage }) {
  return (
    <div className="flex gap-2.5 px-3 py-2.5">
      <AuthorAvatar authorType={message.authorType} author={message.author} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">
            {message.author}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {new Date(message.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.authorType === "agent" && (
            <span className="rounded bg-indigo-500/15 px-1 py-px text-[9px] font-semibold text-indigo-400">
              AI
            </span>
          )}
        </div>
        <div className="prose-review text-[12px] leading-relaxed text-[var(--text-primary)]">
          <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply composer (internal, only shown when expanded)
// ---------------------------------------------------------------------------

function ReplyComposer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setDraft("");
  };

  return (
    <div className="flex gap-2 px-3 py-2.5">
      <textarea
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
        placeholder="Reply... (⌘↵ to send)"
        className="flex-1 resize-none rounded-md bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none ring-1 ring-[var(--border-muted)] transition-shadow focus:ring-[var(--accent-blue)]"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!draft.trim()}
        className={`self-end rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
          draft.trim()
            ? "bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/25 text-blue-400"
            : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
        }`}
      >
        Reply
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status action buttons
// ---------------------------------------------------------------------------

function StatusActions({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: ReviewThread["status"];
  onStatusChange: (status: "open" | "resolved" | "approved") => void;
}) {
  const actionBtn =
    "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all";
  return (
    <div className="ml-auto flex gap-1">
      {currentStatus !== "open" && (
        <button
          type="button"
          onClick={() => onStatusChange("open")}
          className={`${actionBtn} bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]`}
        >
          Reopen
        </button>
      )}
      {currentStatus !== "resolved" && (
        <button
          type="button"
          onClick={() => onStatusChange("resolved")}
          className={`${actionBtn} bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20`}
        >
          Resolve
        </button>
      )}
      {currentStatus !== "approved" && (
        <button
          type="button"
          onClick={() => onStatusChange("approved")}
          className={`${actionBtn} bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}
        >
          Approve
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThreadCard — main export
// ---------------------------------------------------------------------------

export interface ThreadCardProps {
  thread: ReviewThread;
  onReply: (threadId: string, message: string) => void;
  onStatusChange: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
  isExpanded?: boolean;
}

export function ThreadCard({
  thread,
  onReply,
  onStatusChange,
  isExpanded: controlledExpanded,
}: ThreadCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleReply = (text: string) => {
    onReply(thread.id, text);
  };

  const handleStatusChange = (status: "open" | "resolved" | "approved") => {
    onStatusChange(thread.id, status);
  };

  return (
    <div
      id={`thread-${thread.id}`}
      data-thread-id={thread.id}
      className={`thread-enter overflow-hidden rounded-lg bg-[var(--bg-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_var(--border-muted)] transition-all duration-200 ${isExpanded ? "ring-1 ring-[var(--border-default)]" : "hover:shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_0_1px_var(--border-default)]"} `}
    >
      {/* Header: click to expand/collapse */}
      <button
        type="button"
        onClick={() => setInternalExpanded((prev) => !prev)}
        className="hover:bg-[var(--bg-elevated)]/50 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
      >
        <StatusDot status={thread.status} />
        <SeverityBadge severity={thread.severity} />
        <span className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
          {anchorLabel(thread.anchor)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <StatusLabel status={thread.status} />
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {thread.messages.length}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          >
            <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z" />
          </svg>
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-muted)]">
          {/* Status actions bar */}
          <div className="bg-[var(--bg-base)]/50 flex items-center px-3 py-1.5">
            <StatusActions
              currentStatus={thread.status}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Message list */}
          <div className="divide-y divide-[var(--border-muted)]">
            {thread.messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>

          {/* Reply composer */}
          <div className="border-t border-[var(--border-muted)]">
            <ReplyComposer onSubmit={handleReply} />
          </div>
        </div>
      )}
    </div>
  );
}
