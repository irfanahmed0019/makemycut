import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) return;

    // Check if running as standalone (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // Show iOS install instructions after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(timer);
    }

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <Dialog open={showPrompt} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="bg-gradient-to-b from-[#0B0B0B] to-[#121212] border-[#1F1F1F] text-white max-w-sm mx-4">
        <DialogHeader className="space-y-4">
          <div className="text-center pt-4">
            <h1 className="text-4xl font-serif italic text-primary leading-tight">
              Make My<br />Cut
            </h1>
            <p className="text-muted-foreground italic mt-2 text-sm font-sans">
              Your Style. Your Time.
            </p>
          </div>
          
          <DialogTitle className="text-center text-lg font-semibold text-white pt-2">
            Install MakeMyCut
          </DialogTitle>
          
          <DialogDescription className="text-center text-muted-foreground text-sm">
            {isIOS ? (
              <>
                Tap the <span className="text-white font-medium">Share</span> button 
                <span className="mx-1">↑</span> then select 
                <span className="text-white font-medium"> "Add to Home Screen"</span>
              </>
            ) : (
              'Add to your home screen for quick access and a better experience.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-4">
          {!isIOS && deferredPrompt && (
            <Button
              onClick={handleInstall}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20"
            >
              Install App
            </Button>
          )}
          
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full h-10 text-muted-foreground hover:text-white hover:bg-white/5"
          >
            {isIOS ? 'Got it' : 'Maybe Later'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
