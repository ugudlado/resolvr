import type React from "react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "keyboard-hints-seen";
const FADE_THRESHOLD = 5;

/** Shared inline styles for `<kbd>` elements across the app. */
export const kbdStyle: React.CSSProperties = {
  background: "var(--canvas-elevated)",
  border: "1px solid var(--border)",
  color: "var(--ink-ghost)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
};

interface KeyboardHintProps {
  /** The key label(s) to display, e.g. "↑↓" or "j k". */
  label: string;
  className?: string;
}

/**
 * A subtle `<kbd>` badge that disappears after FADE_THRESHOLD page mounts.
 * Uses localStorage to track mount count across sessions.
 */
export function KeyboardHint({ label, className = "" }: KeyboardHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const count = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
    if (count < FADE_THRESHOLD) {
      setVisible(true);
      localStorage.setItem(STORAGE_KEY, String(count + 1));
    }
  }, []);

  if (!visible) return null;

  return (
    <kbd
      className={`rounded px-1 py-px font-mono text-[10px] ${className}`}
      style={kbdStyle}
    >
      {label}
    </kbd>
  );
}
