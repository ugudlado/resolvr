import { useCallback } from "react";

function buildDrawioEditorUrl(xml: string): string {
  const encoded = btoa(unescape(encodeURIComponent(xml)));
  return `https://app.diagrams.net/#R${encoded}`;
}

export interface DiagramToolbarProps {
  name: string;
  /** Raw draw.io XML source */
  source?: string;
  onExpand?: () => void;
  onRerender?: () => void;
  onCopy?: () => void;
}

export function DiagramToolbar({
  name,
  source,
  onExpand,
  onRerender,
  onCopy,
}: DiagramToolbarProps) {
  const handleCopy = useCallback(() => {
    onCopy?.();
  }, [onCopy]);

  const handleOpenEditor = useCallback(() => {
    if (!source) return;
    window.open(buildDrawioEditorUrl(source), "_blank", "noopener");
  }, [source]);

  return (
    <div className="flex items-center justify-between rounded-t-md border border-b-0 border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5">
      <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
        {name}
      </span>
      <div className="flex items-center gap-1">
        {source && (
          <button
            type="button"
            onClick={handleOpenEditor}
            title="Open in draw.io Editor"
            aria-label="Open in draw.io Editor"
            className="rounded p-1 text-[var(--text-secondary)] transition hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
            </svg>
          </button>
        )}
        {onCopy && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy source"
            aria-label="Copy source"
            className="rounded p-1 text-[var(--text-secondary)] transition hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        )}
        {onRerender && (
          <button
            type="button"
            onClick={onRerender}
            title="Reload diagram"
            aria-label="Reload diagram"
            className="rounded p-1 text-[var(--text-secondary)] transition hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        )}
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Expand diagram"
            aria-label="Expand diagram"
            className="rounded p-1 text-[var(--text-secondary)] transition hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
