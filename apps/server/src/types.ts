/**
 * Hono environment type shared across all route files.
 * Defines context variables set by middleware (e.g. repoMiddleware).
 */
export type AppEnv = {
  Variables: {
    repoRoot: string;
    workspaceName: string;
  };
};
