import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./utils/logger";
import { API_BASE } from "./config/app";
import "./index.css";

// Log app startup in development
logger.info("App starting", {
  env: import.meta.env.MODE,
  localApi: API_BASE,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
