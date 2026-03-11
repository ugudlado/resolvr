import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AuthorType,
  THREAD_SEVERITY,
  type ReviewMessage,
  type ReviewThread as SessionsReviewThread,
  type ThreadAnchor,
  type ThreadSeverity,
} from "../../types/sessions";
import type { ReviewThread as ApiReviewThread } from "../../services/localReviewApi";
import { lineLabel } from "../../utils/diffUtils";

const remarkPlugins = [remarkGfm];

/**
 * ThreadCard accepts both the new anchor-based thread type (from sessions.ts)
 * and the legacy flat thread type (from localReviewApi.ts).
 */
export type AnyReviewThread = SessionsReviewThread | ApiReviewThread;

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
export function anchorLabel(anchor: ThreadAnchor | undefined): string {
  if (!anchor) return "General";
  if (anchor.type === "diff-line") {
    const range = lineLabel(anchor.line, anchor.lineEnd);
    return `${anchor.path} ${range}`;
  }
  // Spec block anchor
  const preview =
    anchor.preview.length > 60
      ? anchor.preview.slice(0, 57) + "..."
      : anchor.preview;
  return anchor.path ? `${anchor.path} - ${preview}` : preview;
}

function threadLabel(thread: AnyReviewThread): string {
  if ("anchor" in thread && thread.anchor) {
    return anchorLabel(thread.anchor);
  }
  if ("filePath" in thread) {
    const range = lineLabel(thread.line, thread.lineEnd);
    return `${thread.filePath} ${range}`;
  }
  return "Thread";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: AnyReviewThread["status"] }) {
  const colors: Record<AnyReviewThread["status"], string> = {
    open: "bg-[var(--accent-amber)]",
    resolved: "bg-[var(--accent-blue)]",
    approved: "bg-[var(--accent-emerald)]",
  };
  return (
    <span
      aria-live="polite"
      aria-label={status}
      className={`inline-block h-2 w-2 rounded-full ${colors[status]}`}
    />
  );
}

function StatusLabel({ status }: { status: AnyReviewThread["status"] }) {
  const styles: Record<AnyReviewThread["status"], string> = {
    open: "text-[var(--accent-amber)]",
    resolved: "text-[var(--accent-blue)]",
    approved: "text-[var(--accent-emerald)]",
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
  [THREAD_SEVERITY.Critical]: {
    bg: "bg-[var(--accent-rose-dim)]",
    text: "text-[var(--accent-rose)]",
    dot: "bg-[var(--accent-rose)]",
  },
  [THREAD_SEVERITY.Improvement]: {
    bg: "bg-[var(--accent-blue-dim)]",
    text: "text-[var(--accent-blue)]",
    dot: "bg-[var(--accent-blue)]",
  },
  [THREAD_SEVERITY.Style]: {
    bg: "bg-[var(--canvas-overlay)]",
    text: "text-[var(--ink-faint)]",
    dot: "bg-[var(--ink-faint)]",
  },
  [THREAD_SEVERITY.Question]: {
    bg: "bg-[var(--accent-amber-dim)]",
    text: "text-[var(--accent-amber)]",
    dot: "bg-[var(--accent-amber)]",
  },
};

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity) return null;
  const cfg =
    severityConfig[severity as ThreadSeverity] ??
    severityConfig[THREAD_SEVERITY.Improvement];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1 w-1 rounded-full ${cfg.dot}`} />
      {severity}
    </span>
  );
}

function formatSeverity(severity: string): string {
  if (severity === "improvement") return "Improvement";
  if (severity === "critical") return "Critical";
  if (severity === "style") return "Style";
  return severity;
}

function formatModel(model: string): string {
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function AnalyticsLabels({ labels }: { labels?: Record<string, string> }) {
  if (!labels || Object.keys(labels).length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {labels.severity && (
        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-medium text-blue-300">
          {formatSeverity(labels.severity)}
        </span>
      )}
      {labels.model && (
        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300">
          {formatModel(labels.model)}
        </span>
      )}
    </div>
  );
}

const SEVERITY_OPTIONS: ThreadSeverity[] = [
  THREAD_SEVERITY.Critical,
  THREAD_SEVERITY.Improvement,
  THREAD_SEVERITY.Style,
  THREAD_SEVERITY.Question,
];

function SeveritySelector({
  current,
  onChange,
}: {
  current?: string;
  onChange: (severity: ThreadSeverity) => void;
}) {
  const activeSeverity =
    (current as ThreadSeverity) ?? THREAD_SEVERITY.Improvement;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-[var(--ink-faint)]">Severity:</span>
      {SEVERITY_OPTIONS.map((s) => {
        const cfg = severityConfig[s];
        const isActive = activeSeverity === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-all ${
              isActive
                ? `${cfg.bg} ${cfg.text}`
                : "text-[var(--ink-ghost)] hover:text-[var(--ink-muted)]"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

function AuthorAvatar({
  authorType,
  author,
}: {
  authorType: ReviewMessage["authorType"];
  author: string;
}) {
  if (authorType === AuthorType.Agent) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-[10px] font-bold text-indigo-400">
        AI
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--canvas-overlay)] text-[10px] font-bold text-[var(--ink-muted)]">
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
          <span className="text-[11px] font-semibold text-[var(--ink)]">
            {message.author}
          </span>
          <span className="font-mono text-[10px] text-[var(--ink-ghost)]">
            {new Date(message.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.authorType === AuthorType.Agent && (
            <span className="rounded bg-indigo-500/15 px-1 py-px text-[9px] font-semibold text-indigo-400">
              AI
            </span>
          )}
        </div>
        <div className="prose-review text-[12px] leading-relaxed text-[var(--ink)]">
          <Markdown remarkPlugins={remarkPlugins}>{message.text}</Markdown>
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
        className="flex-1 resize-none rounded-md bg-[var(--canvas)] px-2.5 py-1.5 text-[11px] text-[var(--ink)] placeholder-[var(--ink-ghost)] outline-none ring-1 ring-[var(--border-subtle)] transition-shadow focus:ring-[var(--accent-blue)]"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!draft.trim()}
        className={`self-end rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
          draft.trim()
            ? "bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/25 text-[var(--accent-blue)]"
            : "bg-[var(--canvas-elevated)] text-[var(--ink-ghost)]"
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
  currentStatus: AnyReviewThread["status"];
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
          className={`${actionBtn} bg-[var(--canvas-elevated)] text-[var(--ink-faint)] hover:bg-[var(--canvas-overlay)] hover:text-[var(--ink-muted)]`}
        >
          Reopen
        </button>
      )}
      {currentStatus !== "resolved" && (
        <button
          type="button"
          onClick={() => onStatusChange("resolved")}
          className={`${actionBtn} hover:bg-[var(--accent-blue)]/20 bg-[var(--accent-blue-dim)] text-[var(--accent-blue)]`}
        >
          Resolve
        </button>
      )}
      {currentStatus !== "approved" && (
        <button
          type="button"
          onClick={() => onStatusChange("approved")}
          className={`${actionBtn} hover:bg-[var(--accent-emerald)]/20 bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]`}
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
  thread: AnyReviewThread;
  onReply: (threadId: string, message: string) => void;
  onStatusChange: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
  /** Callback when reviewer changes thread severity via the inline selector. */
  onSeverityChange?: (threadId: string, severity: ThreadSeverity) => void;
  isExpanded?: boolean;
  /** When true, shows a pulsing indicator that this thread is being resolved by Claude. */
  isResolving?: boolean;
}

export function ThreadCard({
  thread,
  onReply,
  onStatusChange,
  onSeverityChange,
  isExpanded: controlledExpanded,
  isResolving = false,
}: ThreadCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const handleReply = (text: string) => {
    onReply(thread.id, text);
  };

  const handleStatusChange = (status: "open" | "resolved" | "approved") => {
    onStatusChange(thread.id, status);
  };

  let cardStateClass: string;
  if (isResolving) {
    cardStateClass = "animate-pulse ring-1 ring-indigo-500/50";
  } else if (isExpanded) {
    cardStateClass = "ring-1 ring-[var(--border)]";
  } else {
    cardStateClass =
      "hover:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_0_1px_var(--border)]";
  }

  return (
    <div
      id={`thread-${thread.id}`}
      data-thread-id={thread.id}
      className={`thread-enter overflow-hidden rounded-lg bg-[var(--canvas-raised)] shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_0_1px_var(--border)] transition-all duration-200 ${cardStateClass} `}
    >
      {/* Header: click to expand/collapse */}
      <button
        type="button"
        onClick={() => setInternalExpanded((prev) => !prev)}
        className="hover:bg-[var(--canvas-elevated)]/50 flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <StatusDot status={thread.status} />
          <SeverityBadge
            severity={"severity" in thread ? thread.severity : undefined}
          />
          <span className="min-w-0 truncate text-[11px] text-[var(--ink-muted)]">
            {threadLabel(thread)}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <StatusLabel status={thread.status} />
            {isResolving && (
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-400">
                <svg
                  className="h-2.5 w-2.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    d="M12 3v3m0 12v3M3 12h3m12 0h3"
                  />
                </svg>
                resolving
              </span>
            )}
            <span className="font-mono text-[10px] text-[var(--ink-ghost)]">
              {thread.messages.length}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`text-[var(--ink-ghost)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            >
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z" />
            </svg>
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {/* Analytics labels for resolved threads */}
          {(thread.status === "resolved" || thread.status === "approved") &&
            "labels" in thread &&
            thread.labels &&
            Object.keys(thread.labels).length > 0 && (
              <div className="bg-[var(--canvas)]/30 px-3 py-2">
                <AnalyticsLabels labels={thread.labels} />
              </div>
            )}

          {/* Status actions bar */}
          <div className="bg-[var(--canvas)]/50 flex items-center gap-2 px-3 py-1.5">
            {onSeverityChange && (
              <SeveritySelector
                current={"severity" in thread ? thread.severity : undefined}
                onChange={(sev) => onSeverityChange(thread.id, sev)}
              />
            )}
            <StatusActions
              currentStatus={thread.status}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Message list */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {thread.messages.map((msg) => (
              <MessageItem key={msg.id} message={msg} />
            ))}
          </div>

          {/* Reply composer */}
          <div className="border-t border-[var(--border-subtle)]">
            <ReplyComposer onSubmit={handleReply} />
          </div>
        </div>
      )}
    </div>
  );
}
