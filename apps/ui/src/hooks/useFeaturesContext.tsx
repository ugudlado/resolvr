import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { featureApi, type FeatureInfo } from "../services/featureApi";

interface FeaturesContextValue {
  features: FeatureInfo[];
  loading: boolean;
  refresh: () => void;
}

const FeaturesContext = createContext<FeaturesContextValue>({
  features: [],
  loading: true,
  refresh: () => {},
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<FeatureInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void featureApi.getFeatures().then(({ features: f }) => {
      setFeatures(f);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FeaturesContext.Provider value={{ features, loading, refresh }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): FeaturesContextValue {
  return useContext(FeaturesContext);
}
