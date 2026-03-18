export const APP_NAME = "Local Review";
export const APP_VERSION = "1.3.0";

/** Base path for all API requests. */
export const API_BASE = "/api";

/**
 * Feature flags — compile-time booleans that gate unfinished features.
 *
 * To enable the full dev workflow (spec review, task board, approve verdict):
 *   Set DEV_WORKFLOW to `true` and rebuild (`pnpm build`).
 */
export const FLAGS = {
  /**
   * When false (default): UI is a focused code-review tool.
   *   - Spec and Tasks tabs hidden
   *   - Approve button hidden (Request Changes always visible)
   *   - Dashboard hides design/design_review statuses
   *
   * When true: full pipeline enabled — spec review, tasks, approve verdict.
   */
  DEV_WORKFLOW: true,
} as const;
