import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useParams,
} from "react-router-dom";
import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import SpecReviewPage from "./pages/SpecReviewPage";
import TasksPage from "./pages/TasksPage";
import { ReviewPage } from "./pages/ReviewPage";
import NotFound from "./pages/NotFound";
import FeatureLayout from "./components/FeatureLayout";
import { featureApi } from "./services/featureApi";
import { getStatusConfig } from "./utils/featureStatus";
import type { FeatureStatus } from "./types/sessions";

/** Redirects /features/:featureId to the tab matching the feature's current status. */
function FeatureDefaultRedirect() {
  const { featureId } = useParams<{ featureId: string }>();
  const [defaultTab, setDefaultTab] = useState<string | null>(null);

  useEffect(() => {
    if (!featureId) return;
    let cancelled = false;
    void featureApi.getFeatures().then(({ features }) => {
      if (cancelled) return;
      const feature = features.find((f) => f.id === featureId);
      if (feature) {
        const config = getStatusConfig(feature.status as FeatureStatus);
        setDefaultTab(config.defaultTab);
      } else {
        setDefaultTab("spec");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [featureId]);

  if (!defaultTab) return null;
  return <Navigate to={defaultTab} replace />;
}

/** Wrapper that resolves a feature's worktree path and renders ReviewPage in embedded mode. */
function FeatureCodeTab() {
  const { featureId } = useParams<{ featureId: string }>();
  const [worktreePath, setWorktreePath] = useState<string | null>(null);

  useEffect(() => {
    if (!featureId) return;
    let cancelled = false;
    void featureApi.getFeatures().then(({ features }) => {
      if (cancelled) return;
      const feature = features.find((f) => f.id === featureId);
      if (feature) setWorktreePath(feature.worktreePath);
    });
    return () => {
      cancelled = true;
    };
  }, [featureId]);

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
