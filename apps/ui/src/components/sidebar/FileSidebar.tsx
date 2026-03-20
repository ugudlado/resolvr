import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { DiffFile } from "../../utils/diffParser";
import type { ReviewThread } from "../../services/localReviewApi";
import { fileName } from "../../utils/diffUtils";
import { OverviewTab } from "./OverviewTab";
import { KeyboardHint } from "../shared/KeyboardHint";
import {
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

export function FileIcon({ status }: { status: DiffFile["status"] }) {
  if (status === "A")
    return (
      <span className="font-mono text-[10px] font-bold text-emerald-400">
        A
      </span>
    );
  if (status === "D")
    return (
      <span className="font-mono text-[10px] font-bold text-red-400">D</span>
    );
  if (status === "M")
    return (
      <span className="font-mono text-[10px] font-bold text-[var(--accent-amber)]">
        M
      </span>
    );
  return (
    <span className="font-mono text-[10px] font-bold text-[var(--text-secondary)]">
      R
    </span>
  );
}

type TreeItem =
  | { kind: "folder"; name: string; children: string[] }
  | { kind: "file"; name: string; file: DiffFile };

interface FileSidebarProps {
  leftTab?: "files" | "overview";
  onTabChange?: (tab: "files" | "overview") => void;
  pendingCount: number;
  visibleFiles: DiffFile[];
  selectedFilePath: string;
  onFileSelect: (path: string) => void;
  showFolderTree: boolean;
  onFolderTreeChange: (v: boolean) => void;
  unresolvedThreadCountByFile: Map<string, number>;
  changeCountByFile: Map<string, number>;
  threads?: ReviewThread[];
  outdatedThreadIds?: Set<string>;
  overviewFilter?: "all" | "open" | "resolved" | "outdated" | "wontfix";
  onOverviewFilterChange?: (
    f: "all" | "open" | "resolved" | "outdated" | "wontfix",
  ) => void;
  onThreadClick?: (thread: ReviewThread) => void;
  onReset?: () => void;
  /** When true, hide the Overview tab and only show Files. */
  hideOverviewTab?: boolean;
  /** Keyboard-driven file index highlight (index into visibleFiles). */
  keyboardSelectedIndex?: number;
  /** Ref to attach to the sidebar <aside> element for focus detection. */
  sidebarRef?: React.RefObject<HTMLElement | null>;
  /** Override sidebar width in pixels. Defaults to 208 (w-52). */
  width?: number;
}

export function FileSidebar({
  leftTab,
  onTabChange,
  pendingCount,
  visibleFiles,
  selectedFilePath,
  onFileSelect,
  showFolderTree,
  onFolderTreeChange,
  unresolvedThreadCountByFile,
  changeCountByFile,
  threads,
  outdatedThreadIds,
  overviewFilter,
  onOverviewFilterChange,
  onThreadClick,
  onReset,
  hideOverviewTab = false,
  keyboardSelectedIndex,
  sidebarRef,
  width,
}: FileSidebarProps) {
  // Build tree data structure from flat file list for headless-tree
  const treeData = useMemo(() => {
    const items: Record<string, TreeItem> = {};
    items["root"] = { kind: "folder", name: "root", children: [] };

    for (const file of visibleFiles) {
      const segments = file.path.split("/");
      let parentId = "root";

      for (let i = 0; i < segments.length - 1; i++) {
        const folderId = segments.slice(0, i + 1).join("/");
        if (!items[folderId]) {
          items[folderId] = {
            kind: "folder",
            name: segments[i],
            children: [],
          };
          const parent = items[parentId] as Extract<
            TreeItem,
            { kind: "folder" }
          >;
          if (!parent.children.includes(folderId)) {
            parent.children.push(folderId);
          }
        }
        parentId = folderId;
      }

      items[file.path] = {
        kind: "file",
        name: fileName(file.path),
        file,
      };
      const parent = items[parentId] as Extract<TreeItem, { kind: "folder" }>;
      if (!parent.children.includes(file.path)) {
        parent.children.push(file.path);
      }
    }

    return items;
  }, [visibleFiles]);

  // O(1) lookup from file path → index in visibleFiles (avoids O(n) indexOf per tree item)
  const fileIndexMap = useMemo(
    () => new Map(visibleFiles.map((f, i) => [f.path, i])),
    [visibleFiles],
  );

  // Headless tree state
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [focusedItem, setFocusedItem] = useState<string | null>(null);

  // Auto-expand all folders when files change
  useEffect(() => {
    const folderIds = Object.entries(treeData)
      .filter(([id, item]) => item.kind === "folder" && id !== "root")
      .map(([id]) => id);
    setExpandedItems(folderIds);
  }, [treeData]);

  // Sync selected items with selectedFilePath
  const selectedItems = useMemo(
    () => (selectedFilePath ? [selectedFilePath] : []),
    [selectedFilePath],
  );

  const tree = useTree<TreeItem>({
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === "folder",
    dataLoader: {
      getItem: (itemId) =>
        treeData[itemId] ?? {
          kind: "folder" as const,
          name: itemId,
          children: [],
        },
      getChildren: (itemId) => {
        const item = treeData[itemId];
        return item?.kind === "folder" ? item.children : [];
      },
    },
    indent: 14,
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
    state: { selectedItems, expandedItems, focusedItem },
    setSelectedItems: (updaterOrValue) => {
      const items =
        typeof updaterOrValue === "function"
          ? updaterOrValue(selectedItems)
          : updaterOrValue;
      // Only select file items, not folders
      const fileItem = items.find(
        (id: string) => treeData[id]?.kind === "file",
      );
      if (fileItem) {
        onFileSelect(fileItem);
      }
    },
    setExpandedItems,
    setFocusedItem: (updaterOrValue) => {
      const itemId =
        typeof updaterOrValue === "function"
          ? updaterOrValue(focusedItem)
          : updaterOrValue;
      setFocusedItem(itemId);
      // Select-follows-focus: arrow key navigation selects file items
      if (itemId && treeData[itemId]?.kind === "file") {
        onFileSelect(itemId);
      }
    },
  });

  // Scroll the keyboard-selected file into view when index changes (flat view)
  const fileListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (keyboardSelectedIndex === undefined || !fileListRef.current) return;
    const target = fileListRef.current.querySelector(
      `[data-file-index="${keyboardSelectedIndex}"]`,
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [keyboardSelectedIndex]);

  return (
    <aside
      ref={sidebarRef as React.RefObject<HTMLElement>}
      tabIndex={0}
      className="flex shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)] outline-none"
      style={{ width: width ?? 208 }}
    >
      {/* Tab switcher (hidden when overview tab is disabled) */}
      {!hideOverviewTab && (
        <div className="flex border-b border-[var(--border-default)]">
          <button
            type="button"
            onClick={() => onTabChange?.("files")}
            className={`flex-1 py-1.5 text-[11px] font-medium ${
              leftTab === "files"
                ? "border-b-2 border-[var(--accent-blue)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.("overview")}
            className={`flex-1 py-1.5 text-[11px] font-medium ${
              leftTab === "overview"
                ? "border-b-2 border-[var(--accent-blue)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Overview{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        </div>
      )}

      {leftTab === "files" && (
        <>
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Files
              </span>
              <KeyboardHint label="↑↓" />
            </div>
            <label className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={showFolderTree}
                onChange={(e) => onFolderTreeChange(e.target.checked)}
                className="accent-indigo-500"
              />
              tree
            </label>
          </div>

          <div ref={fileListRef} className="flex-1 overflow-auto py-1">
            {visibleFiles.length === 0 && (
              <p className="px-4 py-6 text-xs text-[var(--text-muted)]">
                No changed files
              </p>
            )}
            {visibleFiles.length > 0 && showFolderTree && (
              <div
                {...tree.getContainerProps()}
                tabIndex={0}
                className="outline-none"
              >
                {tree.getItems().map((item, index) => {
                  const data = item.getItemData();
                  const level = item.getItemMeta().level;

                  if (data.kind === "folder") {
                    return (
                      <button
                        {...item.getProps()}
                        key={item.getId()}
                        type="button"
                        className="stagger-fade-in flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
                        style={{
                          paddingLeft: `${12 + level * 14}px`,
                          animationDelay: `${index * 50}ms`,
                        }}
                      >
                        <span className="text-[10px]">
                          {item.isExpanded() ? "▼" : "▶"}
                        </span>
                        <span>{data.name}</span>
                      </button>
                    );
                  }

                  const file = data.file;
                  const selected = item.isSelected();
                  const focused = item.isFocused();
                  const unresolved =
                    unresolvedThreadCountByFile.get(file.path) ?? 0;
                  const changeCount = changeCountByFile.get(file.path) ?? 0;
                  const fileNameColor =
                    changeCount > 20
                      ? "var(--text-primary)"
                      : file.status === "A"
                        ? "var(--accent-emerald)"
                        : file.status === "D"
                          ? "var(--accent-rose)"
                          : undefined;
                  const fileNameWeight = changeCount > 20 ? "font-medium" : "";
                  const fileNameClass = "";
                  return (
                    <div key={item.getId()}>
                      <button
                        {...item.getProps()}
                        type="button"
                        data-file-index={fileIndexMap.get(file.path)}
                        title={file.path}
                        className={`stagger-fade-in sidebar-item group flex w-full items-center justify-between gap-1 py-1 text-left text-xs transition-colors ${selected ? "bg-[var(--accent-blue-dim)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
                        style={{
                          paddingLeft: `${8 + level * 10}px`,
                          paddingRight: "12px",
                          animationDelay: `${index * 50}ms`,
                          ...(focused && !selected
                            ? {
                                outline: "1px solid var(--accent-blue)",
                                outlineOffset: "-1px",
                              }
                            : {}),
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <FileIcon status={file.status} />
                          <span
                            className={`min-w-0 truncate font-mono ${fileNameWeight} ${fileNameClass}`}
                            style={{ color: fileNameColor }}
                          >
                            {data.name}
                          </span>
                        </div>
                        {(unresolved > 0 || changeCount > 0) && (
                          <div className="flex shrink-0 items-center gap-1">
                            {unresolved > 0 && (
                              <span className="rounded-full bg-[var(--accent-amber-dim)] px-1.5 text-[10px] font-semibold text-[var(--accent-amber)]">
                                {unresolved}
                              </span>
                            )}
                            {changeCount > 0 && (
                              <span className="text-[10px] text-[var(--text-muted)]">
                                {changeCount}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {visibleFiles.length > 0 &&
              !showFolderTree &&
              visibleFiles.map((file, index) => {
                const active = file.path === selectedFilePath;
                const keyboardActive = keyboardSelectedIndex === index;
                const unresolved =
                  unresolvedThreadCountByFile.get(file.path) ?? 0;
                const changeCount = changeCountByFile.get(file.path) ?? 0;
                const fileNameColor =
                  changeCount > 20
                    ? "var(--text-primary)"
                    : file.status === "A"
                      ? "var(--accent-emerald)"
                      : file.status === "D"
                        ? "var(--accent-rose)"
                        : undefined;
                const fileNameWeight = changeCount > 20 ? "font-medium" : "";
                const fileNameClass = "";
                return (
                  <div key={file.path}>
                    <button
                      type="button"
                      data-file-index={index}
                      onClick={() => onFileSelect(file.path)}
                      title={file.path}
                      className={`stagger-fade-in sidebar-item flex w-full items-center justify-between gap-1 px-3 py-1 text-left text-xs transition-colors ${active ? "bg-[var(--accent-blue-dim)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"}`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                        ...(keyboardActive && !active
                          ? {
                              outline: "1px solid var(--accent-blue)",
                              outlineOffset: "-1px",
                            }
                          : {}),
                      }}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <FileIcon status={file.status} />
                        <span
                          className={`truncate font-mono ${fileNameWeight} ${fileNameClass}`}
                          style={{ color: fileNameColor }}
                        >
                          {fileName(file.path)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {unresolved > 0 && (
                          <span className="rounded-full bg-[var(--accent-amber-dim)] px-1.5 text-[10px] font-semibold text-[var(--accent-amber)]">
                            {unresolved}
                          </span>
                        )}
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {changeCount}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {leftTab === "overview" &&
        threads &&
        outdatedThreadIds &&
        overviewFilter &&
        onOverviewFilterChange &&
        onThreadClick &&
        onReset && (
          <OverviewTab
            threads={threads}
            outdatedThreadIds={outdatedThreadIds}
            overviewFilter={overviewFilter}
            onFilterChange={onOverviewFilterChange}
            onThreadClick={onThreadClick}
            onReset={onReset}
          />
        )}
    </aside>
  );
}
