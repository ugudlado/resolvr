import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AuthorType,
  type ReviewMessage,
  type ReviewThread,
} from "../../types/sessions";
import type { ThreadStatus } from "../../types/constants";
import { relativeTime } from "../../utils/timeFormat";
import { isClosed, normalizeStatus } from "../../utils/threadStatus";
import { ThreadStatusBadge } from "../shared/ThreadStatusBadge";
import { ThreadStatusDropdown } from "../shared/ThreadStatusDropdown";

const remarkPlugins = [remarkGfm];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DiffInlineThreadProps {
  thread: ReviewThread;
  onReply?: (threadId: string, text: string) => void;
  onStatusChange?: (threadId: string, status: ThreadStatus) => void;
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

/** Extract plain text preview from the first message (strip markdown). */
function previewText(text: string, maxLen = 80): string {
  const plain = text
    .replace(/[#*_`~\[\]()>]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain;
}

// ---------------------------------------------------------------------------
// Status-driven style helpers
// ---------------------------------------------------------------------------

function getStatusStyles(thread: ReviewThread) {
  const status = normalizeStatus(thread.status);
  const closed = isClosed(status);
  const isCritical = thread.severity === "critical" && !closed;

  let borderColor = "var(--accent-blue)";
  let bgColor = "var(--bg-elevated)";
  let arrowColor = "var(--bg-elevated)";
  let bgStyle: React.CSSProperties = {};
  let textColor = "var(--text-primary)";

  if (closed) {
    textColor = "var(--text-secondary)";
    bgColor = "var(--bg-surface)";
    arrowColor = "var(--bg-surface)";

    switch (status) {
      case "wontfix":
        borderColor = "var(--text-muted)";
        break;
      case "outdated":
        borderColor = "var(--accent-purple)";
        break;
      default:
        borderColor = "var(--text-muted)";
        break;
    }
  } else if (isCritical) {
    borderColor = "var(--accent-rose)";
    bgColor = "transparent";
    arrowColor = "var(--accent-rose-dim)";
    bgStyle = {
      background:
        "linear-gradient(to right, var(--accent-rose-dim), var(--bg-elevated))",
    };
  }

  return { borderColor, bgColor, arrowColor, bgStyle, textColor, closed };
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({
  author,
  authorType,
}: {
  author: string;
  authorType?: ReviewMessage["authorType"];
}) {
  if (authorType === AuthorType.Agent) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20 text-[10px] font-bold text-indigo-400">
        AI
      </div>
    );
  }
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
      style={{
        background: "var(--bg-overlay)",
        color: "var(--text-primary)",
      }}
    >
      {initials(author)}
    </div>
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

function ReplyRow({ message }: { message: ReviewMessage }) {
  return (
    <div className="flex gap-2" style={{ color: "var(--text-primary)" }}>
      <Avatar author={message.author} authorType={message.authorType} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {message.author}
          </span>
          {message.authorType === AuthorType.Agent && (
            <span className="rounded bg-indigo-500/15 px-1 py-px text-[9px] font-semibold text-indigo-400">
              AI
            </span>
          )}
          <span
            className="text-[10px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {relativeTime(message.createdAt)}
          </span>
        </div>
        <div
          className="prose-review mt-0.5 text-[13px] leading-[1.6]"
          style={{ color: "var(--text-primary)" }}
        >
          <Markdown remarkPlugins={remarkPlugins}>{message.text}</Markdown>
        </div>
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
  const [collapsed, setCollapsed] = useState(() => isClosed(thread.status));

  // Auto-collapse/expand on status change
  const prevStatusRef = useRef(thread.status);
  useEffect(() => {
    if (prevStatusRef.current !== thread.status) {
      prevStatusRef.current = thread.status;
      setCollapsed(isClosed(thread.status));
    }
  }, [thread.status]);

  const firstMessage = thread.messages[0];
  const replies = thread.messages.slice(1);
  const styles = getStatusStyles(thread);

  // Handle reply submit
  const handleReplySubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed || !onReply) return;
    onReply(thread.id, trimmed);
    setDraft("");
    setShowReplyBox(false);
  };

  const handleStatusChange = (status: ThreadStatus) => {
    onStatusChange?.(thread.id, status);
  };

  // ── Collapsed summary bar ──────────────────────────────────────────────
  if (collapsed && styles.closed) {
    return (
      <div
        style={{
          margin: "8px -8px",
          color: "var(--text-primary)",
          background: "transparent",
        }}
      >
        <div
          className="flex cursor-pointer items-center gap-2 rounded-[6px] px-3 py-1.5 transition-colors hover:brightness-110"
          style={{
            borderLeft: `2px solid ${styles.borderColor}`,
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
          onClick={() => setCollapsed(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setCollapsed(false);
          }}
        >
          <ThreadStatusBadge status={thread.status} size="sm" />

          {firstMessage && (
            <span className="text-[12px] font-semibold">
              {firstMessage.author}
            </span>
          )}

          {firstMessage && (
            <span
              className="min-w-0 flex-1 truncate text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {previewText(firstMessage.text)}
            </span>
          )}

          <span
            className="shrink-0 text-[11px]"
            style={{ color: "var(--accent-blue-text)" }}
          >
            Show conversation
          </span>
        </div>
      </div>
    );
  }

  // ── Expanded full thread ───────────────────────────────────────────────
  return (
    <div
      style={{
        margin: "8px -8px",
        color: "var(--text-primary)",
        background: "transparent",
      }}
    >
      {/* CSS triangle pointer arrow */}
      <PointerArrow bgColor={styles.arrowColor} />

      {/* Card */}
      <div
        data-thread-id={thread.id}
        className="overflow-hidden rounded-[6px] p-3 transition-colors"
        style={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: `rgba(255,255,255,0.04)`,
          borderLeftWidth: 2,
          borderLeftStyle: "solid",
          borderLeftColor: styles.borderColor,
          backgroundColor: styles.bgColor,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          color: styles.textColor,
          ...styles.bgStyle,
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2">
          {firstMessage && (
            <Avatar
              author={firstMessage.author}
              authorType={firstMessage.authorType}
            />
          )}

          {/* Author name */}
          {firstMessage && (
            <span className="text-[13px] font-medium">
              {firstMessage.author}
            </span>
          )}

          {/* Timestamp */}
          {firstMessage && (
            <span
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {relativeTime(firstMessage.createdAt)}
            </span>
          )}

          {/* Action buttons */}
          <div className="ml-auto flex items-center gap-1">
            {/* Hide button for non-open threads */}
            {styles.closed && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--bg-overlay)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Hide
              </button>
            )}
            {onReply && (
              <button
                type="button"
                onClick={() => setShowReplyBox((v) => !v)}
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--bg-overlay)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Reply
              </button>
            )}
            {onStatusChange && (
              <ThreadStatusDropdown
                currentStatus={thread.status}
                onStatusChange={handleStatusChange}
              />
            )}
          </div>
        </div>

        {/* Message body */}
        {firstMessage && (
          <div
            className="prose-review mt-1.5 text-[14px] leading-[1.6]"
            style={{ color: "var(--text-primary)" }}
          >
            <Markdown remarkPlugins={remarkPlugins}>
              {firstMessage.text}
            </Markdown>
          </div>
        )}

        {/* Reply thread — indented chain */}
        {replies.length > 0 && (
          <div
            className="ml-8 mt-2 space-y-2 border-l-2 pl-3 pt-2"
            style={{ borderColor: "var(--border-default)" }}
          >
            {replies.map((reply) => (
              <ReplyRow key={reply.id} message={reply} />
            ))}
          </div>
        )}

        {/* Reply composer */}
        {showReplyBox && (
          <div
            className="mt-2 border-t pt-2"
            style={{ borderColor: "var(--border-default)" }}
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
                background: "var(--bg-base)",
                color: "var(--text-primary)",
              }}
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReplyBox(false);
                  setDraft("");
                }}
                className="rounded px-2 py-1 text-[12px] transition-colors hover:bg-[var(--bg-overlay)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReplySubmit}
                disabled={!draft.trim()}
                className="rounded px-2.5 py-1 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--accent-blue-dim)",
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
