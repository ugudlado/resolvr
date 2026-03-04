import { useCallback, useRef, useState } from "react";
import type { SpecBlockAnchor } from "../../types/sessions";
import { DiagramToolbar } from "./DiagramToolbar";

export interface DrawioDiagramProps {
  content: string;
  name: string;
  onAnnotate?: (anchor: SpecBlockAnchor) => void;
}

function buildViewerUrl(xml: string): string {
  const encoded = btoa(unescape(encodeURIComponent(xml)));
  return `https://viewer.diagrams.net/?lightbox=0&nav=1&dark=1&toolbar=0#R${encoded}`;
}

export function DrawioDiagram({
  content,
  name,
  onAnnotate,
}: DrawioDiagramProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewerUrl = buildViewerUrl(content);

  const handleClick = useCallback(() => {
    if (!onAnnotate) return;
    const anchor: SpecBlockAnchor = {
      type: "diagram",
      hash: "",
      path: name,
      preview: content.slice(0, 80),
      blockIndex: 0,
    };
    onAnnotate(anchor);
  }, [onAnnotate, name, content]);

  const handleRerender = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = buildViewerUrl(content);
      setLoading(true);
    }
  }, [content]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).catch(() => {});
  }, [content]);

  const handleExpand = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const loadingPlaceholder = (
    <div className="flex flex-col gap-2 p-4">
      {[2, 1, 3].map((w, i) => (
        <div
          key={i}
          className={`h-4 rounded w-${w}/4`}
          style={{
            backgroundImage:
              "linear-gradient(90deg, var(--bg-surface) 25%, var(--bg-elevated) 50%, var(--bg-surface) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
          }}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="my-3">
        <DiagramToolbar
          name={name}
          source={content}
          onRerender={handleRerender}
          onCopy={handleCopy}
          onExpand={handleExpand}
        />
        <div
          onClick={onAnnotate ? handleClick : undefined}
          role={onAnnotate ? "button" : undefined}
          tabIndex={onAnnotate ? 0 : undefined}
          onKeyDown={
            onAnnotate
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") handleClick();
                }
              : undefined
          }
          className={`relative overflow-hidden rounded-b-md border border-[var(--border-default)] bg-[var(--bg-base)] ${
            onAnnotate
              ? "hover:border-[var(--accent-blue)]/60 cursor-pointer"
              : ""
          }`}
        >
          {loading && loadingPlaceholder}
          <iframe
            ref={iframeRef}
            src={viewerUrl}
            title={`${name} diagram`}
            onLoad={() => setLoading(false)}
            className="w-full border-0"
            style={{
              height: isFullscreen ? "100%" : "500px",
              display: loading ? "none" : "block",
            }}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)]">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {name}
            </span>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded px-3 py-1 text-xs text-[var(--text-secondary)] ring-1 ring-[var(--border-default)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              Close (Esc)
            </button>
          </div>
          <div className="flex-1">
            <iframe
              src={viewerUrl}
              title={`${name} diagram (fullscreen)`}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </>
  );
}
