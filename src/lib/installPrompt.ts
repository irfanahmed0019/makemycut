/**
 * `beforeinstallprompt` fires once, very early — usually before any component
 * that wants to show an Install button has mounted. We capture it at module
 * load (imported from main.tsx) and let components subscribe to it.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const STORAGE_KEY = 'mmc:pwa-installed';
const LEGACY_STORAGE_KEY = 'pwa_install_state';
let installed =
  typeof window !== 'undefined' &&
  (window.localStorage.getItem(STORAGE_KEY) === '1' ||
    window.localStorage.getItem(LEGACY_STORAGE_KEY) === 'installed');
let initialized = false;
let prompting = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const markInstalled = () => {
  installed = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
    window.localStorage.setItem(LEGACY_STORAGE_KEY, 'installed');
  } catch { /* ignore */ }
};

export const isAppInstalled = () =>
  installed ||
  (typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true));

export const getInstallPrompt = () => deferred;

export const subscribeInstallPrompt = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

/** Fires the native install prompt. Returns true if the user accepted. */
export const triggerInstall = async () => {
  if (!deferred || prompting) return false;
  const evt = deferred;
  prompting = true;
  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    deferred = null;
    if (outcome === 'accepted') markInstalled();
    emit();
    return outcome === 'accepted';
  } catch {
    deferred = null;
    emit();
    return false;
  } finally {
    prompting = false;
  }
};

export const initInstallPromptCapture = () => {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    markInstalled();
    deferred = null;
    emit();
  });
};
