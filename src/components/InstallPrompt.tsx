import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_STATE_KEY = 'pwa_install_state';
const INTERACTION_COUNT_KEY = 'pwa_interaction_count';
const LAST_DISMISS_KEY = 'pwa_last_dismiss';
const INTERACTIONS_BEFORE_REPROMPT = 3;

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Check if already installed
  const isInstalled = () => {
    return localStorage.getItem(INSTALL_STATE_KEY) === 'installed' ||
      window.matchMedia('(display-mode: standalone)').matches;
  };

  // Track meaningful interactions
  const trackInteraction = useCallback(() => {
    if (isInstalled()) return;
    
    const currentCount = parseInt(localStorage.getItem(INTERACTION_COUNT_KEY) || '0', 10);
    const newCount = currentCount + 1;
    localStorage.setItem(INTERACTION_COUNT_KEY, String(newCount));

    // Check if we should re-show after dismissal
    const lastDismiss = localStorage.getItem(LAST_DISMISS_KEY);
    if (lastDismiss && newCount >= INTERACTIONS_BEFORE_REPROMPT) {
      localStorage.removeItem(LAST_DISMISS_KEY);
      localStorage.setItem(INTERACTION_COUNT_KEY, '0');
      
      // Only show if we have the deferred prompt (Android) or iOS
      if (deferredPrompt || isIOS) {
        setShowPrompt(true);
      }
    }
  }, [deferredPrompt, isIOS]);

  useEffect(() => {
    // Already installed - never show
    if (isInstalled()) return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Check if first time or after interactions threshold
      const lastDismiss = localStorage.getItem(LAST_DISMISS_KEY);
      if (!lastDismiss) {
        // First time - show after short delay
        setTimeout(() => setShowPrompt(true), 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show after delay if first time
    if (isIOSDevice) {
      const lastDismiss = localStorage.getItem(LAST_DISMISS_KEY);
      if (!lastDismiss) {
        setTimeout(() => setShowPrompt(true), 2000);
      }
    }

    // Track scroll and click interactions
    const handleScroll = () => trackInteraction();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Track meaningful clicks (buttons, links, cards)
      if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
        trackInteraction();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('click', handleClick);
    };
  }, [trackInteraction]);

  const handleInstall = async () => {
    if (isIOS) {
      // Can't programmatically install on iOS, just close
      setShowPrompt(false);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem(INSTALL_STATE_KEY, 'installed');
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(LAST_DISMISS_KEY, Date.now().toString());
    localStorage.setItem(INTERACTION_COUNT_KEY, '0');
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-[#0B0B0B] rounded-t-3xl px-6 pt-8 pb-10 mx-auto max-w-md relative border-t border-white/10">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* App Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-primary/20">
              <img 
                src="/app-icon.png" 
                alt="MakeMyCut" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-foreground mb-3">
            Install App
          </h2>

          {/* Subtitle */}
          <p className="text-center text-muted-foreground text-sm leading-relaxed mb-8 px-4">
            {isIOS ? (
              <>
                Tap <span className="text-foreground font-medium">Share</span> then{' '}
                <span className="text-foreground font-medium">"Add to Home Screen"</span> for the full experience.
              </>
            ) : (
              'Step inside the full experience. Faster booking, offline access, and premium features await.'
            )}
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            {!isIOS && deferredPrompt && (
              <Button
                onClick={handleInstall}
                className="w-full h-14 bg-white hover:bg-white/90 text-black font-semibold rounded-2xl text-base shadow-lg"
              >
                Install Now
              </Button>
            )}
            
            {isIOS && (
              <Button
                onClick={handleDismiss}
                className="w-full h-14 bg-white hover:bg-white/90 text-black font-semibold rounded-2xl text-base shadow-lg"
              >
                Got It
              </Button>
            )}
            
            {!isIOS && (
              <button
                onClick={handleDismiss}
                className="w-full py-3 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
