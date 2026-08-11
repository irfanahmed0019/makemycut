/**
 * Short branded MakeMyCut chime, played only when a MakeMyCut window is open and
 * the service worker reports an incoming push. When the app is closed the OS
 * default notification sound is used — browsers give PWAs no custom-sound API.
 */
import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'mmc_notification_sound_url';
let ctx: AudioContext | null = null;
let customUrl: string | null = null;

const playChime = () => {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    ctx = ctx ?? new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    // Two-note rising chime: clean, short, non-intrusive.
    [[880, 0], [1318.5, 0.11]].forEach(([freq, at]) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.14, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.24);
    });
  } catch {
    /* audio is optional — never break notifications */
  }
};

const play = () => {
  if (customUrl) {
    try {
      const audio = new Audio(customUrl);
      audio.volume = 0.7;
      void audio.play().catch(() => playChime());
      return;
    } catch {
      /* fall through to the built-in chime */
    }
  }
  playChime();
};

export const initPushSound = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Admin-configured sound: use the cached value instantly, then refresh it.
  try { customUrl = localStorage.getItem(CACHE_KEY) || null; } catch { /* ignore */ }
  void (async () => {
    const { data } = await (supabase as any)
      .from('app_settings').select('text_value').eq('key', 'notification_sound_url').maybeSingle();
    customUrl = data?.text_value || null;
    try {
      if (customUrl) localStorage.setItem(CACHE_KEY, customUrl);
      else localStorage.removeItem(CACHE_KEY);
    } catch { /* ignore */ }
  })();

  window.addEventListener('mmc-preview-sound', () => playChime());
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'MMC_PUSH_SOUND') play();
  });
};

/** Applies a newly saved admin sound immediately, without a page reload. */
export const setPushSoundUrl = (url: string | null) => {
  customUrl = url || null;
  try {
    if (customUrl) localStorage.setItem(CACHE_KEY, customUrl);
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
};