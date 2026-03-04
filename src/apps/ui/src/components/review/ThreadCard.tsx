import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ReviewMessage,
  ReviewThread,
} from "../../services/localReviewApi";
import { threadRangeLabel } from "../../utils/diffUtils";

function StatusDot({ status }: { status: ReviewThread["status"] }) {
  const colors: Record<ReviewThread["status"], string> = {
    open: "bg-amber-400",
    resolved: "bg-indigo-400",
    approved: "bg-emerald-400",
  };
  return (
    <span
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
      className={`text-[10px] font-semibold uppercase tracking-wider ${styles[status]}`}
    >
      {status}
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

export function ThreadCard({
  thread,
  replyDraft,
  onReplyChange,
  onReply,
  onStatusChange,
}: {
  thread: ReviewThread;
  replyDraft: string;
  onReplyChange: (value: string) => void;
  onReply: () => void;
  onStatusChange: (status: ReviewThread["status"]) => void;
}) {
  const actionBtn =
    "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all";

  return (
    <div
      id={`thread-${thread.id}`}
      className="mt-2 overflow-hidden rounded-lg bg-[var(--bg-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_0_1px_var(--border-muted)] transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_0_1px_var(--border-default)]"
    >
      {/* Header with status + actions */}
      <div className="flex items-center gap-2 px-3 py-2">
        <StatusDot status={thread.status} />
        <StatusLabel status={thread.status} />
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {threadRangeLabel(thread)}
        </span>
        <div className="ml-auto flex gap-1">
          {thread.status !== "open" && (
            <button
              type="button"
              onClick={() => onStatusChange("open")}
              className={`${actionBtn} bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]`}
            >
              Reopen
            </button>
          )}
          {thread.status !== "resolved" && (
            <button
              type="button"
              onClick={() => onStatusChange("resolved")}
              className={`${actionBtn} bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20`}
            >
              Resolve
            </button>
          )}
          {thread.status !== "approved" && (
            <button
              type="button"
              onClick={() => onStatusChange("approved")}
              className={`${actionBtn} bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}
            >
              Approve
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="divide-y divide-[var(--border-muted)]">
        {thread.messages.map((msg) => (
          <div key={msg.id} className="flex gap-2.5 px-3 py-2.5">
            <AuthorAvatar authorType={msg.authorType} author={msg.author} />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                  {msg.author}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {new Date(msg.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {msg.authorType === "agent" && (
                  <span className="rounded bg-indigo-500/15 px-1 py-px text-[9px] font-semibold text-indigo-400">
                    AI
                  </span>
                )}
              </div>
              <div className="prose-review text-[12px] leading-relaxed text-[var(--text-primary)]">
                <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      <div className="flex gap-2 border-t border-[var(--border-muted)] px-3 py-2.5">
        <textarea
          rows={2}
          value={replyDraft}
          onChange={(e) => onReplyChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onReply();
          }}
          placeholder="Reply… (⌘↵ to send)"
          className="flex-1 resize-none rounded-md bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none ring-1 ring-[var(--border-muted)] transition-shadow focus:ring-[var(--accent-blue)]"
        />
        <button
          type="button"
          onClick={onReply}
          disabled={!replyDraft.trim()}
          className={`self-end rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
            replyDraft.trim()
              ? "bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/25 text-blue-400"
              : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          }`}
        >
          Reply
        </button>
      </div>
    </div>
  );
}
