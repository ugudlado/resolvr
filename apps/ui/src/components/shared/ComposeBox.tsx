import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ComposeBoxProps {
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Smaller padding and font for inline use in thread replies. */
  compact?: boolean;
  /** Quoted text to display above the textarea (e.g. selected text). */
  quotedText?: string;
}

/**
 * Shared compose box with textarea, submit, and optional cancel button.
 *
 * Purely presentational -- the caller provides the onSubmit handler
 * that knows how to create or reply to a thread.
 *
 * Severity is auto-classified after thread creation, so no manual
 * severity selector is needed here.
 */
export function ComposeBox({
  onSubmit,
  onCancel,
  placeholder = "Leave a comment...",
  autoFocus = false,
  compact = false,
  quotedText,
}: ComposeBoxProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = text.trim().length === 0;

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    setText("");
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, onSubmit]);

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

  const rowCount = compact ? 2 : 3;

  return (
    <div className="compose-enter border-border bg-canvas-elevated overflow-hidden rounded-md border shadow-lg">
      {quotedText && (
        <div className="border-accent-blue/40 bg-canvas-overlay mx-3 mb-2 mt-3 rounded-sm border-l-2 px-3 py-2">
          <p className="text-ink-muted text-[13px] italic leading-relaxed">
            {quotedText.length > 200
              ? `${quotedText.slice(0, 200)}...`
              : quotedText}
          </p>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        rows={rowCount}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={`${placeholder} (⌘↵ to submit${onCancel ? ", Esc to cancel" : ""})`}
        autoFocus={autoFocus}
        className="text-ink placeholder-ink-ghost min-h-[80px] w-full resize-none bg-transparent px-3 py-2.5 text-[14px] outline-none"
      />
      <div className="border-border flex items-center justify-end gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-1">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-ink-muted hover:text-ink hover:bg-canvas-overlay text-[13px]"
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isEmpty}
            className="bg-accent-blue hover:bg-accent-blue/90 text-[13px] text-white"
          >
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
