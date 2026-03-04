import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { ThreadSeverity } from "../../types/sessions";

export interface ComposeBoxProps {
  onSubmit: (text: string, severity?: ThreadSeverity) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Smaller padding and font for inline use in thread replies. */
  compact?: boolean;
  /** Quoted text to display above the textarea (e.g. selected text). */
  quotedText?: string;
  /** Show severity selector pills. Defaults to true. */
  showSeverity?: boolean;
}

/**
 * Shared compose box with textarea, submit, and optional cancel button.
 *
 * Purely presentational -- the caller provides the onSubmit handler
 * that knows how to create or reply to a thread.
 */
const SEVERITIES: ThreadSeverity[] = ["blocking", "suggestion", "nitpick"];

const severityStyles: Record<
  ThreadSeverity,
  { active: string; inactive: string }
> = {
  blocking: {
    active:
      "bg-red-500/15 text-red-400 shadow-[inset_0_0_0_1px_rgba(248,81,73,0.2)]",
    inactive: "text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10",
  },
  suggestion: {
    active:
      "bg-blue-500/15 text-blue-400 shadow-[inset_0_0_0_1px_rgba(88,166,255,0.2)]",
    inactive:
      "text-[var(--text-muted)] hover:text-blue-400 hover:bg-blue-500/10",
  },
  nitpick: {
    active:
      "bg-[var(--bg-overlay)] text-[var(--text-tertiary)] shadow-[inset_0_0_0_1px_var(--border-muted)]",
    inactive:
      "text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)]",
  },
};

export function ComposeBox({
  onSubmit,
  onCancel,
  placeholder = "Leave a comment...",
  autoFocus = false,
  compact = false,
  quotedText,
  showSeverity = true,
}: ComposeBoxProps) {
  const [text, setText] = useState("");
  const [severity, setSeverity] = useState<ThreadSeverity>("suggestion");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = text.trim().length === 0;

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed, showSeverity ? severity : undefined);
    setText("");
    setSeverity("suggestion");
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSubmit, severity, showSeverity]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset to auto so scrollHeight recalculates on shrink
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const padCls = compact ? "p-2" : "p-3";
  const fontCls = compact ? "text-[11px]" : "text-xs";
  const rowCount = compact ? 2 : 3;

  return (
    <div
      className={`compose-enter overflow-hidden rounded-lg bg-[var(--bg-surface)] ${
        compact
          ? ""
          : "shadow-[0_2px_8px_rgba(0,0,0,0.4),0_0_0_1px_var(--border-muted)]"
      }`}
    >
      {quotedText && (
        <div className="border-b border-[var(--border-muted)] px-3 py-2">
          <div className="max-h-20 overflow-y-auto rounded-md border-l-2 border-blue-500/40 bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            {quotedText.length > 200
              ? `${quotedText.slice(0, 200)}...`
              : quotedText}
          </div>
        </div>
      )}
      <div className={padCls}>
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            rows={rowCount}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={`${placeholder} (⌘↵ to submit${onCancel ? ", Esc to cancel" : ""})`}
            autoFocus={autoFocus}
            className={`flex-1 resize-none rounded-md bg-[var(--bg-base)] px-2.5 py-1.5 ${fontCls} text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none ring-1 ring-[var(--border-muted)] transition-shadow focus:ring-[var(--accent-blue)]`}
          />
          <div className="flex flex-col gap-1.5 self-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isEmpty}
              className={`rounded-md px-3 py-1 ${fontCls} font-medium transition-all ${
                isEmpty
                  ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                  : "bg-[var(--accent-blue)]/15 hover:bg-[var(--accent-blue)]/25 text-blue-400"
              }`}
            >
              Comment
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className={`rounded-md bg-[var(--bg-elevated)] px-3 py-1 ${fontCls} text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]`}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {showSeverity && (
          <div className="mt-2 flex gap-1">
            {SEVERITIES.map((s) => {
              const isActive = severity === s;
              const style = severityStyles[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                    isActive ? style.active : style.inactive
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
