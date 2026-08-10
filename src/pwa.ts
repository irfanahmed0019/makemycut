/**
 * Single, guarded service-worker registrar.
 *
 * The service worker must NEVER run in dev / Lovable preview / iframes,
 * otherwise an old app shell can be served after a deployment and users get
 * stale JS (which shows up as inexplicable auth/booking failures).
 * `?sw=off` is a kill switch that unregisters the worker.
 */
const SW_URL = "/sw.js";

const isBlockedContext = () => {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
};

const unregisterAppWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister()),
  );
};

export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    await unregisterAppWorkers();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

    // Check for a fresh deployment on load and whenever the tab regains focus,
    // so a long-lived tab cannot sit on an old build.
    const checkForUpdate = () => registration.update().catch(() => undefined);
    checkForUpdate();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });

    // autoUpdate takes control automatically; reload once so the next paint
    // uses the new assets instead of the previous build.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  } catch {
    // Registration failures must never break the app.
  }
};
