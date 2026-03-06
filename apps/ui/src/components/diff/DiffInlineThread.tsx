import { useState } from "react";
import type { ReviewThread } from "../../types/sessions";
import { relativeTime } from "../../utils/timeFormat";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffInlineThreadProps {
  thread: ReviewThread;
  onReply?: (threadId: string, text: string) => void;
  onStatusChange?: (
    threadId: string,
    status: "open" | "resolved" | "approved",
  ) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(author: string): string {
  const parts = author.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return author.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ author }: { author: string }) {
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
      style={{
        background: "var(--canvas-overlay)",
        color: "var(--ink)",
      }}
    >
      {initials(author)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({
  severity,
  isResolved,
}: {
  severity?: ReviewThread["severity"];
  isResolved: boolean;
}) {
  if (!severity || isResolved) return null;

  const severityStyles: Record<string, string> = {
    blocking: "bg-[var(--accent-amber)]/15 text-[var(--accent-amber)]",
    suggestion: "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]",
  };
  const styles =
    severityStyles[severity] ??
    "bg-[var(--canvas-overlay)] text-[var(--ink-muted)]";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${styles}`}>
      {severity}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pointer arrow (CSS triangle)
// ---------------------------------------------------------------------------

function PointerArrow({ bgColor }: { bgColor: string }) {
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderBottom: `6px solid ${bgColor}`,
        marginLeft: 12,
        marginBottom: -1,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Reply row (compact)
// ---------------------------------------------------------------------------

function ReplyRow({ author, text }: { author: string; text: string }) {
  return (
    <div className="flex gap-2" style={{ color: "var(--ink)" }}>
      <Avatar author={author} />
      <div className="min-w-0 flex-1">
        <span
          className="mr-1.5 text-[12px] font-medium"
          style={{ color: "var(--ink)" }}
        >
          {author}
        </span>
        <span
          className="text-[13px] leading-[1.6]"
          style={{ color: "var(--ink)" }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffInlineThread — main export
// ---------------------------------------------------------------------------

export function DiffInlineThread({
  thread,
  onReply,
  onStatusChange,
}: DiffInlineThreadProps) {
  const [draft, setDraft] = useState("");
  const [showReplyBox, setShowReplyBox] = useState(false);

  const isResolved = thread.status === "resolved";
  const firstMessage = thread.messages[0];
  const replies = thread.messages.slice(1);

  // Determine severity-based styles
  const severity = thread.severity;
  const isBlocking = severity === "blocking" && !isResolved;

  // Left border color
  let borderColor = "var(--accent-blue)";
  if (isResolved) borderColor = "var(--ink-ghost)";
  else if (isBlocking) borderColor = "var(--accent-amber)";

  // Background
  const bgStyle: React.CSSProperties = isBlocking
    ? { background: "linear-gradient(to right, #25221e, #222228)" }
    : {};
  let bgColor = "var(--canvas-elevated)";
  if (isResolved) bgColor = "var(--canvas-raised)";
  else if (isBlocking) bgColor = "transparent";

  // Arrow color matches card background
  let arrowColor = "#2a2a31"; // canvas-elevated
  if (isResolved)
    arrowColor = "#222228"; // canvas-raised
  else if (isBlocking) arrowColor = "#25221e"; // warm gradient start

  // Handle reply submit
  const handleReplySubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || !onReply) return;
    onReply(thread.id, trimmed);
    setDraft("");
    setShowReplyBox(false);
  };

  return (
    <div
      style={{
        margin: "8px -8px",
        color: "var(--ink)",
        background: "transparent",
      }}
    >
      {/* CSS triangle pointer arrow */}
      <PointerArrow bgColor={arrowColor} />

      {/* Card */}
      <div
        data-thread-id={thread.id}
        className="overflow-hidden rounded-[6px] p-3 transition-opacity"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: `rgba(255,255,255,0.04)`,
          borderLeftWidth: 2,
          borderLeftStyle: "solid",
          borderLeftColor: borderColor,
          backgroundColor: bgColor,
          boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
          opacity: isResolved ? 0.65 : 1,
          color: "var(--ink)",
          ...bgStyle,
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2">
          {firstMessage && <Avatar author={firstMessage.author} />}

          {/* Author name */}
          {firstMessage && (
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              {firstMessage.author}
            </span>
          )}

          {/* Severity badge */}
          <SeverityBadge severity={severity} isResolved={isResolved} />

          {/* Timestamp */}
          {firstMessage && (
            <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {relativeTime(firstMessage.createdAt)}
            </span>
          )}

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1">
            {onReply && (
              <button
                type="button"
                onClick={() => setShowReplyBox((v) => !v)}
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--canvas-overlay)]"
                style={{ color: "var(--ink-muted)" }}
              >
                Reply
              </button>
            )}
            {onStatusChange && (
              <button
                type="button"
                onClick={() =>
                  onStatusChange(thread.id, isResolved ? "open" : "resolved")
                }
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--canvas-overlay)]"
                style={{ color: "var(--ink-muted)" }}
              >
                {isResolved ? "Reopen" : "Resolve"}
              </button>
            )}
          </div>
        </div>

        {/* Message body */}
        {firstMessage && (
          <p
            className="prose-review mt-1.5 text-[14px] leading-[1.6]"
            style={{ color: "var(--ink)" }}
          >
            {firstMessage.text}
          </p>
        )}

        {/* Reply thread */}
        {replies.length > 0 && (
          <div
            className="mt-2 space-y-2 border-t pt-2"
            style={{ borderColor: "var(--border)" }}
          >
            {replies.map((reply) => (
              <ReplyRow
                key={reply.id}
                author={reply.author}
                text={reply.text}
              />
            ))}
          </div>
        )}

        {/* Reply composer */}
        {showReplyBox && (
          <div
            className="mt-2 border-t pt-2"
            style={{ borderColor: "var(--border)" }}
          >
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleReplySubmit();
                }
              }}
              placeholder="Reply... (Cmd+Enter to send)"
              className="w-full resize-none rounded-md px-2.5 py-1.5 text-[12px] outline-none ring-1 ring-[var(--border)] transition-shadow focus:ring-[var(--accent-blue)]"
              style={{
                background: "var(--canvas)",
                color: "var(--ink)",
              }}
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReplyBox(false);
                  setDraft("");
                }}
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--canvas-overlay)]"
                style={{ color: "var(--ink-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReplySubmit}
                disabled={!draft.trim()}
                className="rounded px-2.5 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "rgba(96, 165, 250, 0.15)",
                  color: "var(--accent-blue)",
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
