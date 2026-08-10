import { useEffect, useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import {
  getInstallPrompt,
  isAppInstalled,
  subscribeInstallPrompt,
  triggerInstall,
} from '@/lib/installPrompt';

const manualSteps = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Tap the Share button, then choose "Add to Home Screen".';
  if (/Android/i.test(ua)) return 'Open the browser menu (⋮), then tap "Install app" or "Add to Home screen".';
  return 'Open your browser menu, then choose "Install app" or "Add to Home screen".';
};

export const InstallAppCard = () => {
  // The install event is captured globally at app start, so the button works
  // instantly even though it fired long before Profile mounted.
  const [canPrompt, setCanPrompt] = useState(Boolean(getInstallPrompt()));
  const [installed, setInstalled] = useState(isAppInstalled);
  const [showSteps, setShowSteps] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const installAttempt = useRef(false);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  useEffect(
    () =>
      subscribeInstallPrompt(() => {
        setCanPrompt(Boolean(getInstallPrompt()));
        setInstalled(isAppInstalled());
      }),
    [],
  );

  const runProgress = () => {
    const total = 23000;
    const start = Date.now();
    setProgress(0);
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / total) * 100);
      setProgress(pct);
      if (pct >= 100 && timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
        setProgress(null);
      }
    }, 200);
  };

  const handleInstall = async () => {
    if (progress !== null || installAttempt.current) return;
    if (!getInstallPrompt()) {
      setShowSteps(true);
      return;
    }
    installAttempt.current = true;
    setShowSteps(false);
    runProgress();
    const accepted = await triggerInstall();
    if (accepted) {
      setInstalled(true);
    } else {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      setProgress(null);
      if (!getInstallPrompt()) setShowSteps(true);
    }
    installAttempt.current = false;
  };

  if (installed) {
    return (
      <div className="py-2 px-1">
        <div className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
          </div>
          <p className="text-sm font-medium text-foreground">MakeMyCut is installed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 px-1">
      <button
        type="button"
        onClick={handleInstall}
        disabled={progress !== null}
        className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <span className="material-symbols-outlined text-lg">install_mobile</span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Install MakeMyCut</p>
            <p className="text-[11px] leading-tight text-muted-foreground">Add to home screen for quick access</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-primary whitespace-nowrap">
          {progress !== null ? 'Installing…' : 'Install'}
        </span>
      </button>

      {progress !== null && (
        <div className="mt-2 space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[11px] text-muted-foreground">Setting up MakeMyCut on your device…</p>
        </div>
      )}
      {showSteps && !canPrompt && (
        <p className="mt-2 text-xs text-muted-foreground">{manualSteps()}</p>
      )}
    </div>
  );
};
