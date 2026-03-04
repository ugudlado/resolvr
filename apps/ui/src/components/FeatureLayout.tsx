import { Outlet, useParams } from "react-router-dom";
import FeatureNavBar from "./FeatureNavBar";
import { FeaturesProvider } from "../hooks/useFeaturesContext";

/**
 * Layout wrapper for all feature routes (/features/:featureId/*)
 * Renders the FeatureNavBar top bar + Outlet for child routes.
 * Wraps children in FeaturesProvider so all feature sub-routes share one fetch.
 */
export default function FeatureLayout() {
  const { featureId } = useParams<{ featureId: string }>();

  return (
    <FeaturesProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-base)] text-slate-200">
        <FeatureNavBar featureId={featureId ?? ""} />

        <div className="min-h-0 flex-1">
          <Outlet />
        </div>
      </div>
    </FeaturesProvider>
  );
}
