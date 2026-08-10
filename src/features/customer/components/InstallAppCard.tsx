import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari
  (window.navigator as unknown as { standalone?: boolean }).standalone === true;

const manualSteps = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Tap the Share button, then choose "Add to Home Screen".';
  if (/Android/i.test(ua)) return 'Open the browser menu (⋮), then tap "Install app" or "Add to Home screen".';
  return 'Open your browser menu, then choose "Install app" or "Add to Home screen".';
};

export const InstallAppCard = () => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!prompt) {
      setShowSteps(true);
      return;
    }
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
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
      <Button className="w-full" onClick={handleInstall}>Install MakeMyCut</Button>
      {showSteps && !prompt && (
        <p className="text-xs text-muted-foreground">{manualSteps()}</p>
      )}
    </div>
  );
};
