import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

export interface Workspace {
  name: string;
  path: string;
}

export function useRepoContext() {
  const [searchParams] = useSearchParams();
  const repo = searchParams.get("repo");
  const workspace = searchParams.get("workspace");

  return { repo, workspace };
}

/** Append ?repo= or ?workspace= to a URL path */
export function withRepo(
  url: string,
  repo: string | null,
  workspace?: string | null,
): string {
  if (!repo && !workspace) return url;
  const sep = url.includes("?") ? "&" : "?";
  if (workspace)
    return `${url}${sep}workspace=${encodeURIComponent(workspace)}`;
  if (repo) return `${url}${sep}repo=${encodeURIComponent(repo)}`;
  return url;
}

export function useWorkspaces(): { workspaces: Workspace[]; loaded: boolean } {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: { workspaces?: Workspace[] }) => {
        setWorkspaces(data.workspaces ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, []);
  return { workspaces, loaded };
}
