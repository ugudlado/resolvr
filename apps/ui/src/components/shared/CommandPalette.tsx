import { useState, useEffect, useRef, useMemo } from "react";

interface CommandItem {
  id: string;
  label: string;
  group: "Files" | "Threads" | "Actions";
  icon?: React.ReactNode;
  shortcut?: string;
  onAction: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  // Group filtered results
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      (groups[item.group] ??= []).push(item);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const result: CommandItem[] = [];
    for (const group of ["Files", "Threads", "Actions"]) {
      if (grouped[group]) result.push(...grouped[group]);
    }
    return result;
  }, [grouped]);

  // Clamp selected index
  useEffect(() => {
    setSelectedIndex((prev) =>
      Math.min(prev, Math.max(0, flatList.length - 1)),
    );
  }, [flatList.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatList[selectedIndex]) {
            flatList[selectedIndex].onAction();
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, flatList, selectedIndex, onClose]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="border-b border-[var(--border-default)] p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, threads, actions..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            aria-label="Command palette search"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {flatList.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              No results found
            </p>
          )}
          {(["Files", "Threads", "Actions"] as const).map((group) => {
            const groupItems = grouped[group];
            if (!groupItems?.length) return null;
            return (
              <div key={group} className="mb-2">
                <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  {group}
                </p>
                {groupItems.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-[var(--accent-blue-muted)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
                      }`}
                      onClick={() => {
                        item.onAction();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 text-[var(--text-tertiary)]">
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="flex-shrink-0 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-[var(--border-default)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
          <span className="mr-3">&#8593;&#8595; navigate</span>
          <span className="mr-3">&#8629; select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
