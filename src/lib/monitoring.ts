/**
 * Lightweight production error monitoring.
 *
 * Captures frontend runtime errors, unhandled promise rejections and
 * explicitly reported failures (bookings, auth, RPC, edge functions).
 *
 * Sinks:
 *  - console (always)
 *  - optional external collector via `VITE_ERROR_REPORT_URL`
 *    (a plain HTTPS endpoint that accepts a JSON POST; no credentials are
 *    embedded here — configure the URL as an environment variable).
 *
 * Nothing sensitive is sent: no tokens, passwords, UPI ids or full payloads.
 */

export type ErrorScope =
  | "runtime"
  | "booking"
  | "auth"
  | "rpc"
  | "database"
  | "edge-function";

const ENDPOINT: string | undefined = import.meta.env.VITE_ERROR_REPORT_URL;

const SENSITIVE = /(token|password|apikey|api_key|authorization|upi|secret|jwt)/i;

const sanitize = (context: Record<string, unknown> = {}) => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE.test(key)) continue;
    out[key] = typeof value === "string" ? value.slice(0, 300) : value;
  }
  return out;
};

export const reportError = (
  scope: ErrorScope,
  error: unknown,
  context: Record<string, unknown> = {},
) => {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  const payload = {
    scope,
    message: (message || "Unknown error").slice(0, 500),
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
    context: sanitize(context),
    url: typeof window !== "undefined" ? window.location.pathname : undefined,
    at: new Date().toISOString(),
  };

  // Always visible in browser/devtools and in hosting logs.
  console.error(`[${scope}]`, payload.message, payload.context);

  if (!ENDPOINT) return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // Monitoring must never break the app.
  }
};

let installed = false;

export const initMonitoring = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    reportError("runtime", event.error ?? event.message, { source: event.filename });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError("runtime", event.reason, { kind: "unhandledrejection" });
  });
};