import type { DirectorySalon } from '@/features/directory/components/SalonCard';

const KEY = 'mmc_pending_salon_action';

export interface PendingSalonAction {
  action: 'book' | 'queue';
  salon: DirectorySalon;
}

export const setPendingAction = (data: PendingSalonAction) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

export const consumePendingAction = (): PendingSalonAction | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PendingSalonAction;
  } catch {
    return null;
  }
};