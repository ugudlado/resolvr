import { useEffect } from "react";
import type { CommitInfo } from "../services/localReviewApi";

export function useDiffNavigation(params: {
  commits: CommitInfo[];
  selectedCommit: string;
  onCommitChange: (hash: string) => void;
}) {
  const { commits, selectedCommit, onCommitChange } = params;

  useEffect(() => {
    const optionHashes = ["all", ...commits.map((c) => c.hash)];
    const current = selectedCommit || "all";
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      )
        return;
      if (event.key !== "[" && event.key !== "]") return;
      event.preventDefault();
      const index = optionHashes.indexOf(current);
      if (index === -1) return;
      const nextIndex =
        event.key === "["
          ? Math.max(index - 1, 0)
          : Math.min(index + 1, optionHashes.length - 1);
      const next = optionHashes[nextIndex];
      onCommitChange(next === "all" ? "" : next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commits, selectedCommit, onCommitChange]);
}
