import { useEffect, useState } from "react";
import { featureApi } from "../../services/featureApi";
import { DrawioDiagram } from "./DrawioDiagram";
import type { SpecBlockAnchor } from "../../types/sessions";

interface DiagramEntry {
  name: string;
  content: string;
}

export interface DiagramsSectionProps {
  featureId: string;
  onAnnotate?: (anchor: SpecBlockAnchor) => void;
}

/**
 * Renders all diagrams vertically. Display order:
 *   1. Non-before/after diagrams (alphabetical)
 *   2. before
 *   3. after
 */
export function DiagramsSection({
  featureId,
  onAnnotate,
}: DiagramsSectionProps) {
  const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const { diagrams: names } = await featureApi.getDiagrams(featureId);
        if (cancelled) return;

        const entries = await Promise.all(
          names.map(async (name) => {
            const { content } = await featureApi.getDiagram(featureId, name);
            return { name, content };
          }),
        );

        if (!cancelled) {
          setDiagrams(entries);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load diagrams",
          );
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  if (loading) {
    return (
      <div className="px-6 py-4 text-xs text-slate-600">
        Loading diagrams...
      </div>
    );
  }

  if (error) {
    return <div className="px-6 py-4 text-xs text-red-400">{error}</div>;
  }

  if (diagrams.length === 0) return null;

  const baseName = (d: DiagramEntry) => d.name.replace(/\.drawio$/, "");
  const before = diagrams.find((d) => baseName(d) === "before");
  const after = diagrams.find((d) => baseName(d) === "after");
  const rest = diagrams.filter(
    (d) => baseName(d) !== "before" && baseName(d) !== "after",
  );

  return (
    <div className="mt-2 space-y-1">
      {rest.map((d) => (
        <DrawioDiagram
          key={d.name}
          content={d.content}
          name={baseName(d)}
          onAnnotate={onAnnotate}
        />
      ))}

      {/* Before / After pair */}
      {(before ?? after) && (
        <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
          {before && (
            <DrawioDiagram
              content={before.content}
              name={baseName(before)}
              onAnnotate={onAnnotate}
            />
          )}
          {after && (
            <DrawioDiagram
              content={after.content}
              name={baseName(after)}
              onAnnotate={onAnnotate}
            />
          )}
        </div>
      )}
    </div>
  );
}
