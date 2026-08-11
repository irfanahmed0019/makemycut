/**
 * Short branded MakeMyCut chime, played only when a MakeMyCut window is open and
 * the service worker reports an incoming push. When the app is closed the OS
 * default notification sound is used — browsers give PWAs no custom-sound API.
 */
let ctx: AudioContext | null = null;

const play = () => {
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

export const initPushSound = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'MMC_PUSH_SOUND') play();
  });
};