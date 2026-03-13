import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Dashboard from "./pages/Dashboard";
import TasksPage from "./pages/TasksPage";
import { ReviewPage } from "./pages/ReviewPage";
import NotFound from "./pages/NotFound";
import FeatureLayout from "./components/FeatureLayout";
import { getStatusConfig } from "./utils/featureStatus";
import { FeaturesProvider, useFeatures } from "./hooks/useFeaturesContext";
import { FLAGS } from "./config/app";
import { FEATURE_TAB } from "./types/constants";

/** Root layout that provides FeaturesProvider to all routes. */
function RootLayout() {
  return (
    <FeaturesProvider>
      <Outlet />
    </FeaturesProvider>
  );
}

/** Redirects /features/:featureId to the tab matching the feature's current status. */
function FeatureDefaultRedirect() {
  const { featureId } = useParams<{ featureId: string }>();
  const { features, loading, error } = useFeatures();

  const defaultTab = useMemo(() => {
    if (!FLAGS.DEV_WORKFLOW) return FEATURE_TAB.Code;
    const feature = features.find((f) => f.id === featureId);
    if (!feature) return FEATURE_TAB.Code;
    return getStatusConfig(feature.status).defaultTab;
  }, [features, featureId]);

  if (loading || (error && features.length === 0)) return null;
  return <Navigate to={defaultTab} replace />;
}

/** Wrapper that resolves a feature's worktree path and renders ReviewPage in embedded mode. */
function FeatureCodeTab() {
  const { featureId } = useParams<{ featureId: string }>();
  const { features, loading, error } = useFeatures();

  const feature = useMemo(
    () => features.find((f) => f.id === featureId) ?? null,
    [features, featureId],
  );

  if ((loading || error) && !feature) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      </div>
    );
  }

  if (!feature?.worktreePath) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      </div>
    );
  }

  return (
    <ReviewPage
      featureId={featureId}
      worktreePath={feature.worktreePath}
      sourceBranch={feature.branch}
      embedded
    />
  );
}

/** Standalone ReviewPage that reads ?source= and ?worktree= from the URL.
 *  Auto-detects the matching feature from the features list so sessions load. */
function StandaloneReviewPage() {
  const [params] = useSearchParams();
  const source = params.get("source") ?? undefined;
  const worktree = params.get("worktree") ?? undefined;
  const { features } = useFeatures();

  // Fetch the server's default worktree (detects which worktree the server runs from)
  const [serverWorktree, setServerWorktree] = useState<string | null>(null);
  useEffect(() => {
    if (source || worktree) return; // URL params take precedence
    void fetch("/api/context")
      .then((r) => r.json())
      .then((ctx: { currentWorktree?: string }) => {
        if (ctx.currentWorktree) setServerWorktree(ctx.currentWorktree);
      })
      .catch(() => {});
  }, [source, worktree]);

  // Try to find a feature whose branch matches the source param or worktree path
  const matchedFeature = useMemo(() => {
    if (!features.length) return null;
    if (source) {
      const byBranch = features.find((f) => f.branch === source);
      if (byBranch) return byBranch;
    }
    if (worktree) {
      const byWorktree = features.find((f) => f.worktreePath === worktree);
      if (byWorktree) return byWorktree;
    }
    // Match server's current worktree (handles running from a feature worktree)
    if (serverWorktree) {
      const byServer = features.find((f) => f.worktreePath === serverWorktree);
      if (byServer) return byServer;
    }
    // Fallback: if only one non-main feature exists, use it
    const nonMain = features.filter((f) => f.branch !== "main");
    if (nonMain.length === 1) return nonMain[0];
    return null;
  }, [features, source, worktree, serverWorktree]);

  return (
    <ReviewPage
      featureId={matchedFeature?.id}
      sourceBranch={source ?? matchedFeature?.branch}
      worktreePath={worktree ?? matchedFeature?.worktreePath}
    />
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: "/",
        element: FLAGS.DEV_WORKFLOW ? <Dashboard /> : <StandaloneReviewPage />,
      },
      {
        path: "/features/:featureId",
        element: <FeatureLayout />,
        children: [
          {
            index: true,
            element: <FeatureDefaultRedirect />,
          },
          ...(FLAGS.DEV_WORKFLOW
            ? [{ path: FEATURE_TAB.Tasks, element: <TasksPage /> }]
            : []),
          {
            path: FEATURE_TAB.Code,
            element: <FeatureCodeTab />,
          },
        ],
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
