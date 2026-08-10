import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
    if (progress !== null) return;
    if (!getInstallPrompt()) {
      setShowSteps(true);
      return;
    }
    runProgress();
    const accepted = await triggerInstall();
    if (accepted) {
      setInstalled(true);
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      setProgress(null);
    }
  };

  if (installed) {
    return (
      <div className="flex items-center gap-4 py-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <span className="material-symbols-outlined text-primary">check_circle</span>
        </div>
        <p className="text-base text-foreground">MakeMyCut is installed</p>
      </div>
    );
  }

  return (
    <div className="py-3 px-1 space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <span className="material-symbols-outlined">install_mobile</span>
        </div>
        <div>
          <p className="text-base text-foreground">Install MakeMyCut</p>
          <p className="text-xs text-muted-foreground">Get faster access and an app-like experience.</p>
        </div>
      </div>
      <Button className="w-full" onClick={handleInstall} disabled={progress !== null}>
        {progress !== null ? 'Installing…' : 'Install MakeMyCut'}
      </Button>
      {progress !== null && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">Setting up MakeMyCut on your device…</p>
        </div>
      )}
      {showSteps && !canPrompt && (
        <p className="text-xs text-muted-foreground">{manualSteps()}</p>
      )}
    </div>
  );
};
