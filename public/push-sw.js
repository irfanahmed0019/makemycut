/* MakeMyCut Web Push handlers.
 * This file is imported into the generated Workbox service worker
 * (see vite.config.ts -> workbox.importScripts), so push works even when the
 * PWA, the tab, or the whole browser is closed.
 */

/** Per-type presentation. Vibration is a hint: platforms that ignore it still show the notification. */
const TYPE_CONFIG = {
  appointment_confirmed:    { vibrate: [150, 80, 150], requireInteraction: false },
  appointment_booked:       { vibrate: [150, 80, 150], requireInteraction: false },
  appointment_accepted:     { vibrate: [150, 80, 150], requireInteraction: false },
  appointment_reminder:     { vibrate: [120, 60, 120], requireInteraction: false },
  appointment_starting_soon:{ vibrate: [200, 90, 200, 90, 200], requireInteraction: true },
  appointment_cancelled:    { vibrate: [300], requireInteraction: false },
  appointment_rescheduled:  { vibrate: [150, 80, 150, 80, 150], requireInteraction: false },
  check_in_reminder:        { vibrate: [120, 60, 120], requireInteraction: false },
  last_minute:              { vibrate: [100, 50, 100, 50, 200], requireInteraction: false },
  promotion:                { vibrate: [80], requireInteraction: false },
};

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MakeMyCut", body: event.data ? event.data.text() : "" };
  }

  const type = data.notificationType || data.type || null;
  const cfg = (type && TYPE_CONFIG[type]) || { vibrate: [150, 80, 150], requireInteraction: false };

  const rawTitle = data.title || "MakeMyCut";
  const title = /makemycut/i.test(rawTitle) ? rawTitle : `✂️ MakeMyCut — ${rawTitle}`;
  const options = {
    body: data.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: type ? `mmc-${type}-${data.appointmentId || data.appointment_id || ""}` : undefined,
    renotify: false,
    // Ignored where unsupported — never breaks delivery.
    vibrate: cfg.vibrate,
    requireInteraction: cfg.requireInteraction,
    data: {
      url: data.url || "/",
      appointmentId: data.appointmentId || data.appointment_id || null,
      notificationType: type,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Progressive enhancement: if a MakeMyCut window is open, let it play the
      // short branded chime. Closed-app notifications use the OS default sound.
      try {
        const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientList) client.postMessage({ type: "MMC_PUSH_SOUND", notificationType: type });
      } catch { /* ignore */ }
    })(),
  );
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