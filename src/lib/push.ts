import { supabase } from '@/integrations/supabase/client';

export type PushSupport = { supported: boolean; reason?: string };

export const checkPushSupport = (): PushSupport => {
  if (typeof window === 'undefined') return { supported: false, reason: 'Unavailable' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'Your browser does not support service workers.' };
  if (!('PushManager' in window)) return { supported: false, reason: 'Your browser does not support the Push API.' };
  if (!('Notification' in window)) return { supported: false, reason: 'Your browser does not support notifications.' };
  if (!window.isSecureContext) return { supported: false, reason: 'Notifications require a secure (https) connection.' };
  return { supported: true };
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

let cachedKey: string | null = null;
export const getVapidPublicKey = async (): Promise<string> => {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke('push-public-key');
  if (error || !data?.publicKey) throw new Error('Push is not configured on the server yet.');
  cachedKey = data.publicKey as string;
  return cachedKey;
};

/**
 * Push must work for everyone — installed PWA *and* plain browser tabs
 * (including dev/preview where the app-shell worker is intentionally blocked).
 * If the Workbox app worker isn't there, register the standalone push worker.
 */
const PUSH_SW_URL = '/push-sw.js';

const getRegistration = async (): Promise<ServiceWorkerRegistration> => {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing?.active || existing?.waiting || existing?.installing) return existing;
  const reg = await navigator.serviceWorker.register(PUSH_SW_URL, { scope: '/' });
  await navigator.serviceWorker.ready.catch(() => undefined);
  return reg;
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  if (!checkPushSupport().supported) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return await reg.pushManager.getSubscription();
};

const persistSubscription = async (sub: PushSubscription) => {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  const { data, error } = await supabase.functions.invoke('push-subscribe', {
    body: {
      action: 'subscribe',
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent.slice(0, 300),
    },
  });
  if (error || !data?.ok) throw new Error('Could not save your notification device. Please try again.');
};

/** Full enable flow. Throws with a user-friendly message on any failure. */
export const enablePushNotifications = async (): Promise<void> => {
  const support = checkPushSupport();
  if (!support.supported) throw new Error(support.reason!);

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission === 'denied') {
    throw new Error('Notifications are blocked in your browser settings for this site.');
  }
  if (permission !== 'granted') throw new Error('Notification permission was dismissed.');

  const key = await getVapidPublicKey();
  const reg = await getRegistration();

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // If the stored key changed, resubscribe with the current one.
    const current = sub.options?.applicationServerKey;
    if (!current) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  await persistSubscription(sub);

  // Friendly confirmation right in the notification tray — works in a plain
  // browser tab too, no PWA install needed.
  try {
    await reg.showNotification('Thanks for allowing notifications ;)', {
      body: "You're all set — we'll keep you posted about your appointments.",
      icon: '/app-icon-192.png',
      badge: '/badge-96.png',
      tag: 'mmc-welcome',
    });
  } catch {
    /* non-fatal */
  }
};

export const disablePushNotifications = async (): Promise<void> => {
  const sub = await getExistingSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  await supabase.functions.invoke('push-subscribe', { body: { action: 'unsubscribe', endpoint } });
};

export const resyncSubscription = async () => {
  const sub = await getExistingSubscription();
  if (sub) await persistSubscription(sub).catch(() => undefined);
};