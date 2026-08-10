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
let installed = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

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
  if (!deferred) return false;
  const evt = deferred;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  deferred = null;
  if (outcome === 'accepted') installed = true;
  emit();
  return outcome === 'accepted';
};

export const initInstallPromptCapture = () => {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
};
