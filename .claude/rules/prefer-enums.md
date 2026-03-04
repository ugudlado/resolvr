# Prefer Enums Over String Literals

Use TypeScript enums or `as const` objects instead of repeated string literals for state values, modes, statuses, and types.

Examples:

- `DiffMode.Unified` instead of `"unified"`
- `ThreadStatus.Open` instead of `"open"`

This prevents typos, enables autocomplete, and makes refactoring safer.
