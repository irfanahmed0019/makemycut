import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./pwa";
import { initMonitoring } from "./lib/monitoring";
import { initInstallPromptCapture } from "./lib/installPrompt";
import { initPushSound } from "./lib/pushSound";

initMonitoring();
initInstallPromptCapture();
initPushSound();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);

registerServiceWorker();
