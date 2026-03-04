/**
 * tasksParser.ts
 *
 * Pure utility to parse a tasks.md file into the TaskProgress structure.
 * No file I/O — the caller reads the file and passes the content.
 */

import type { Task, TaskProgress, Phase, TaskStatus } from "../types/sessions";

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

/**
 * Maps checkbox markers to TaskStatus values.
 *
 * Marker → Status:
 *   [ ]  → pending
 *   [→]  → in_progress
 *   [x]  → done
 *   [~]  → skipped
 */
function parseTaskStatus(marker: string): TaskStatus {
  switch (marker) {
    case " ":
      return "pending";
    case "→":
      return "in_progress";
    case "x":
      return "done";
    case "~":
      return "skipped";
    default:
      return "pending";
  }
}

// ---------------------------------------------------------------------------
// Task line parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single task list item line.
 *
 * Format: `- [marker] ID: Description (depends: T001, T002) [P]`
 *
 * Returns null if the line doesn't match the expected task format.
 */
function parseTaskLine(line: string): Task | null {
  // Match the checkbox marker — supports [ ], [→], [x], [~]
  const taskMatch = line.match(/^\s*-\s+\[([^\]]*)\]\s+(.+)$/);
  if (!taskMatch) return null;

  const marker = taskMatch[1];
  const rest = taskMatch[2].trim();

  // Extract task ID (e.g. "T001") — must be followed by ": "
  const idMatch = rest.match(/^(T\d+):\s+/);
  if (!idMatch) return null;

  const id = idMatch[1];
  let remaining = rest.slice(idMatch[0].length);

  // Check for parallelizable flag [P] at the end
  const parallelizable = /\[P\]\s*$/.test(remaining);
  if (parallelizable) {
    remaining = remaining.replace(/\s*\[P\]\s*$/, "");
  }

  // Extract dependencies from "(depends: T001, T002)"
  let dependencies: string[] = [];
  const dependsMatch = remaining.match(/\s*\(depends:\s*([^)]+)\)\s*$/);
  if (dependsMatch) {
    dependencies = dependsMatch[1].split(",").map((d) => d.trim());
    remaining = remaining.slice(0, remaining.length - dependsMatch[0].length);
  }

  const description = remaining.trim();

  return {
    id,
    description,
    status: parseTaskStatus(marker),
    dependencies,
    parallelizable,
  };
}

/**
 * Parses a task description detail line (indented under a task).
 *
 * Format: `  - **Key**: Value`
 *
 * Returns the key and value, or null if the line doesn't match.
 */
function parseDescriptionLine(
  line: string,
): { key: "why" | "files" | "doneWhen"; value: string } | null {
  const match = line.match(/^\s+-\s+\*\*(.+?)\*\*:\s+(.+)$/);
  if (!match) return null;

  const rawKey = match[1].trim();
  const value = match[2].trim();

  switch (rawKey) {
    case "Why":
      return { key: "why", value };
    case "Files":
      return { key: "files", value };
    case "Done when":
      return { key: "doneWhen", value };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Phase progress helper
// ---------------------------------------------------------------------------

/**
 * Computes completion stats for a single phase.
 */
export function getPhaseProgress(phase: Phase): {
  total: number;
  completed: number;
  percentage: number;
} {
  const total = phase.tasks.length;
  const completed = phase.tasks.filter(
    (t) => t.status === "done" || t.status === "skipped",
  ).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parses tasks.md markdown content into a TaskProgress structure.
 *
 * @param markdown - The full text content of a tasks.md file.
 */
export function parseTasksMarkdown(markdown: string): TaskProgress {
  const lines = markdown.split("\n");

  let featureId = "";
  let developmentMode: "TDD" | "Non-TDD" = "Non-TDD";
  const phases: Phase[] = [];
  let currentPhaseName: string | null = null;
  let currentTasks: Task[] = [];

  for (const line of lines) {
    // Stop processing at the Status Legend section
    if (/^##\s+Status Legend/.test(line)) {
      break;
    }

    // Feature ID heading: # Tasks: FEATURE_ID
    const featureIdMatch = line.match(/^#\s+Tasks:\s+(.+)$/);
    if (featureIdMatch) {
      featureId = featureIdMatch[1].trim();
      continue;
    }

    // Development mode heading: ## Development Mode: TDD|Non-TDD
    const devModeMatch = line.match(/^##\s+Development Mode:\s+(.+)$/);
    if (devModeMatch) {
      const mode = devModeMatch[1].trim();
      developmentMode = mode === "TDD" ? "TDD" : "Non-TDD";
      continue;
    }

    // Phase heading: ### Phase N: Name
    const phaseMatch = line.match(/^###\s+(.+)$/);
    if (phaseMatch) {
      // Flush previous phase
      if (currentPhaseName !== null) {
        const { percentage } = getPhaseProgress({
          name: currentPhaseName,
          tasks: currentTasks,
          progress: 0,
        });
        phases.push({
          name: currentPhaseName,
          tasks: currentTasks,
          progress: percentage,
        });
      }
      currentPhaseName = phaseMatch[1].trim();
      currentTasks = [];
      continue;
    }

    // Task line or description line (only collected when inside a phase)
    if (currentPhaseName !== null) {
      const task = parseTaskLine(line);
      if (task) {
        currentTasks.push(task);
        continue;
      }

      // Check for description detail lines attached to the most recent task
      if (currentTasks.length > 0) {
        const detail = parseDescriptionLine(line);
        if (detail) {
          currentTasks[currentTasks.length - 1][detail.key] = detail.value;
        }
      }
    }
  }

  // Flush the last phase
  if (currentPhaseName !== null) {
    const { percentage } = getPhaseProgress({
      name: currentPhaseName,
      tasks: currentTasks,
      progress: 0,
    });
    phases.push({
      name: currentPhaseName,
      tasks: currentTasks,
      progress: percentage,
    });
  }

  // Aggregate totals
  const total = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const completed = phases.reduce(
    (sum, p) =>
      sum +
      p.tasks.filter((t) => t.status === "done" || t.status === "skipped")
        .length,
    0,
  );
  const inProgress = phases.reduce(
    (sum, p) => sum + p.tasks.filter((t) => t.status === "in_progress").length,
    0,
  );
  const overallProgress =
    total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    featureId,
    developmentMode,
    total,
    completed,
    inProgress,
    phases,
    overallProgress,
  };
}

/*
 * ---------------------------------------------------------------------------
 * Smoke test (expected output — run mentally or via ts-node)
 * ---------------------------------------------------------------------------
 *
 * Input:
 *   const md = `
 *   # Tasks: MY-001-some-feature
 *
 *   ## Development Mode: Non-TDD
 *
 *   ### Phase 1: Foundation
 *
 *   - [ ] T001: Set up project structure
 *   - [→] T002: Configure API routes (depends: T001)
 *   - [x] T003: Write types (depends: T001) [P]
 *   - [~] T004: Write legacy adapter (depends: T001, T002)
 *
 *   ### Phase 2: Components
 *
 *   - [ ] T005: Build sidebar (depends: T003, T004)
 *
 *   ## Status Legend
 *   ...
 *   `;
 *
 *   parseTasksMarkdown(md)
 *
 * Expected output:
 *   {
 *     featureId: "MY-001-some-feature",
 *     developmentMode: "Non-TDD",
 *     total: 5,
 *     completed: 2,       // T003 (done) + T004 (skipped)
 *     inProgress: 1,      // T002
 *     overallProgress: 40,
 *     phases: [
 *       {
 *         name: "Phase 1: Foundation",
 *         progress: 50,   // 2 of 4 tasks completed/skipped
 *         tasks: [
 *           { id: "T001", description: "Set up project structure",          status: "pending",     dependencies: [],              parallelizable: false },
 *           { id: "T002", description: "Configure API routes",              status: "in_progress", dependencies: ["T001"],         parallelizable: false },
 *           { id: "T003", description: "Write types",                       status: "done",        dependencies: ["T001"],         parallelizable: true  },
 *           { id: "T004", description: "Write legacy adapter",              status: "skipped",     dependencies: ["T001", "T002"], parallelizable: false },
 *         ],
 *       },
 *       {
 *         name: "Phase 2: Components",
 *         progress: 0,
 *         tasks: [
 *           { id: "T005", description: "Build sidebar", status: "pending", dependencies: ["T003", "T004"], parallelizable: false },
 *         ],
 *       },
 *     ],
 *   }
 */
