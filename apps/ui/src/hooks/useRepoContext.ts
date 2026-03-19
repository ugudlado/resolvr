import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

export interface Workspace {
  name: string;
  path: string;
}

export function useRepoContext() {
  const [searchParams] = useSearchParams();
  const workspace = searchParams.get("workspace");
  return { workspace };
}

/** Append ?workspace= to a URL path when a workspace is specified. */
export function withWorkspace(
  url: string,
  workspace: string | null | undefined,
): string {
  if (!workspace) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}workspace=${encodeURIComponent(workspace)}`;
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
