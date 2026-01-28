import { useEffect, useCallback } from 'react';

const INTERACTION_COUNT_KEY = 'pwa_interaction_count';

/**
 * Hook to track meaningful user interactions for PWA install re-prompting
 * Call this after meaningful actions like booking, login, etc.
 */
export const usePWAInstall = () => {
  const trackMeaningfulAction = useCallback(() => {
    const currentCount = parseInt(localStorage.getItem(INTERACTION_COUNT_KEY) || '0', 10);
    localStorage.setItem(INTERACTION_COUNT_KEY, String(currentCount + 1));
  }, []);

  return { trackMeaningfulAction };
};

/**
 * Check if app is running as installed PWA
 */
export const isPWAInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    localStorage.getItem('pwa_install_state') === 'installed';
};
