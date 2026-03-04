import type { DiffFile } from "../../utils/diffParser";
import type { ReviewThread } from "../../services/localReviewApi";
import { buildFolderRows, fileName } from "../../utils/diffUtils";
import { OverviewTab } from "./OverviewTab";

export function FileIcon({ status }: { status: DiffFile["status"] }) {
  if (status === "A")
    return (
      <span className="font-mono text-[10px] font-bold text-emerald-400">
        A
      </span>
    );
  if (status === "D")
    return (
      <span className="font-mono text-[10px] font-bold text-rose-400">D</span>
    );
  if (status === "M")
    return (
      <span className="font-mono text-[10px] font-bold text-amber-400">M</span>
    );
  return (
    <span className="font-mono text-[10px] font-bold text-slate-400">R</span>
  );
}

interface FileSidebarProps {
  leftTab?: "files" | "overview";
  onTabChange?: (tab: "files" | "overview") => void;
  pendingCount: number;
  visibleFiles: DiffFile[];
  selectedFilePath: string;
  onFileSelect: (path: string) => void;
  showFolderTree: boolean;
  onFolderTreeChange: (v: boolean) => void;
  collapsedFolders: Set<string>;
  onFolderToggle: (path: string) => void;
  unresolvedThreadCountByFile: Map<string, number>;
  changeCountByFile: Map<string, number>;
  threads?: ReviewThread[];
  outdatedThreadIds?: Set<string>;
  overviewFilter?: "all" | "open" | "resolved" | "outdated";
  onOverviewFilterChange?: (
    f: "all" | "open" | "resolved" | "outdated",
  ) => void;
  onThreadClick?: (thread: ReviewThread) => void;
  onReset?: () => void;
  /** When true, hide the Overview tab and only show Files. */
  hideOverviewTab?: boolean;
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
  collapsedFolders,
  onFolderToggle,
  unresolvedThreadCountByFile,
  changeCountByFile,
  threads,
  outdatedThreadIds,
  overviewFilter,
  onOverviewFilterChange,
  onThreadClick,
  onReset,
  hideOverviewTab = false,
}: FileSidebarProps) {
  const folderRows = buildFolderRows(visibleFiles, collapsedFolders);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
      {/* Tab switcher (hidden when overview tab is disabled) */}
      {!hideOverviewTab && (
        <div className="flex border-b border-[var(--border-default)]">
          <button
            type="button"
            onClick={() => onTabChange?.("files")}
            className={`flex-1 py-1.5 text-[11px] font-medium ${
              leftTab === "files"
                ? "border-b-2 border-[var(--accent-blue)] text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.("overview")}
            className={`flex-1 py-1.5 text-[11px] font-medium ${
              leftTab === "overview"
                ? "border-b-2 border-[var(--accent-blue)] text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Overview{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        </div>
      )}

      {leftTab === "files" && (
        <>
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Files
            </span>
            <label className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
              <input
                type="checkbox"
                checked={showFolderTree}
                onChange={(e) => onFolderTreeChange(e.target.checked)}
                className="accent-indigo-500"
              />
              tree
            </label>
          </div>

          <div className="flex-1 overflow-auto py-1">
            {visibleFiles.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-600">
                No changed files
              </p>
            ) : showFolderTree ? (
              folderRows.map((row, index) => {
                if (row.kind === "folder") {
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => onFolderToggle(row.path)}
                      className="stagger-fade-in flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300"
                      style={{
                        paddingLeft: `${12 + row.depth * 14}px`,
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <span className="text-[10px]">
                        {row.collapsed ? "▶" : "▼"}
                      </span>
                      <span>{row.name}</span>
                    </button>
                  );
                }

                const file = row.file;
                const active = file.path === selectedFilePath;
                const unresolved =
                  unresolvedThreadCountByFile.get(file.path) || 0;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => onFileSelect(file.path)}
                    title={file.path}
                    className={`stagger-fade-in sidebar-item flex w-full items-center justify-between gap-1 py-1 text-left text-xs transition-colors ${active ? "bg-[var(--accent-blue)]/20 text-slate-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                    style={{
                      paddingLeft: `${12 + row.depth * 14}px`,
                      paddingRight: "12px",
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <FileIcon status={file.status} />
                      <span className="truncate font-mono">
                        {fileName(file.path)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {unresolved > 0 && (
                        <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                          {unresolved}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600">
                        {changeCountByFile.get(file.path) || 0}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              visibleFiles.map((file, index) => {
                const active = file.path === selectedFilePath;
                const unresolved =
                  unresolvedThreadCountByFile.get(file.path) || 0;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => onFileSelect(file.path)}
                    title={file.path}
                    className={`stagger-fade-in sidebar-item flex w-full items-center justify-between gap-1 px-3 py-1 text-left text-xs transition-colors ${active ? "bg-[var(--accent-blue)]/20 text-slate-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <FileIcon status={file.status} />
                      <span className="truncate font-mono">
                        {fileName(file.path)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {unresolved > 0 && (
                        <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                          {unresolved}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600">
                        {changeCountByFile.get(file.path) || 0}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
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
