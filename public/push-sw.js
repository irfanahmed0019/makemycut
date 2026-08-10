/* MakeMyCut Web Push handlers.
 * This file is imported into the generated Workbox service worker
 * (see vite.config.ts -> workbox.importScripts), so push works even when the
 * PWA, the tab, or the whole browser is closed.
 */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MakeMyCut", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "MakeMyCut";
  const options = {
    body: data.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: data.notificationType ? `mmc-${data.notificationType}-${data.appointmentId || ""}` : undefined,
    renotify: false,
    data: {
      url: data.url || "/",
      appointmentId: data.appointmentId || null,
      notificationType: data.notificationType || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const url = new URL(target, self.location.origin).href;
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(url); } catch { /* ignore */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});

// Chrome can rotate a subscription; re-register silently when that happens.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED" });
    })(),
  );
});