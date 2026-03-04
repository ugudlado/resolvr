import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { useMemo } from "react";
import Dashboard from "./pages/Dashboard";
import SpecReviewPage from "./pages/SpecReviewPage";
import TasksPage from "./pages/TasksPage";
import { ReviewPage } from "./pages/ReviewPage";
import NotFound from "./pages/NotFound";
import FeatureLayout from "./components/FeatureLayout";
import { getStatusConfig } from "./utils/featureStatus";
import { useFeatures } from "./hooks/useFeaturesContext";

/** Redirects /features/:featureId to the tab matching the feature's current status. */
function FeatureDefaultRedirect() {
  const { featureId } = useParams<{ featureId: string }>();
  const { features, loading } = useFeatures();

  const defaultTab = useMemo(() => {
    const feature = features.find((f) => f.id === featureId);
    if (feature) return getStatusConfig(feature.status).defaultTab;
    return "spec";
  }, [features, featureId]);

  if (loading && features.length === 0) return null;
  return <Navigate to={defaultTab} replace />;
}

/** Wrapper that resolves a feature's worktree path and renders ReviewPage in embedded mode. */
function FeatureCodeTab() {
  const { featureId } = useParams<{ featureId: string }>();
  const { features, loading } = useFeatures();

  const worktreePath = useMemo(
    () => features.find((f) => f.id === featureId)?.worktreePath ?? null,
    [features, featureId],
  );

  if (loading && !worktreePath) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      </div>
    );
  }

  if (!worktreePath) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d1117]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
      </div>
    );
  }

  return <ReviewPage worktreePath={worktreePath} embedded />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
  },
  {
    path: "/features/:featureId",
    element: <FeatureLayout />,
    children: [
      {
        index: true,
        element: <FeatureDefaultRedirect />,
      },
      {
        path: "spec",
        element: <SpecReviewPage />,
      },
      {
        path: "tasks",
        element: <TasksPage />,
      },
      {
        path: "code",
        element: <FeatureCodeTab />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
