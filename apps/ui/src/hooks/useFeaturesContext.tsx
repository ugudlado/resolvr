import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { featureApi, type FeatureInfo } from "../services/featureApi";

interface FeaturesContextValue {
  features: FeatureInfo[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: [],
  loading: true,
  error: false,
  refresh: () => {},
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const workspace = searchParams.get("workspace");
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    setError(false);
    void featureApi
      .getFeatures(workspace)
      .then(({ features: f }) => {
        setFeatures(f);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspace]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FeaturesContext.Provider value={{ features, loading, error, refresh }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): FeaturesContextValue {
  return useContext(FeaturesContext);
}
