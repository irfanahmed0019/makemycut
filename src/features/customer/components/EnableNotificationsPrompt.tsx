import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

const DISMISS_KEY = 'mmc_push_prompt_dismissed';

/**
 * Soft opt-in shown after a meaningful action (e.g. a confirmed booking),
 * never on first page load. The native permission dialog is only triggered
 * after the user taps "Enable".
 */
export const EnableNotificationsPrompt = () => {
  const { supported, permission, subscribed, checking, loading, enable } = usePushNotifications();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  if (!supported || checking || subscribed || dismissed || permission === 'denied') return null;

  const handleEnable = async () => {
    const ok = await enable();
    toast(
      ok
        ? { title: 'Thanks for allowing notifications ;)', description: 'We will alert you about this appointment.' }
        : { variant: 'destructive', title: 'Could not enable notifications' },
    );
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-primary">notifications_active</span>
        <div>
          <p className="text-sm font-medium text-foreground">Get appointment alerts</p>
          <p className="text-xs text-muted-foreground">
            We'll notify you about confirmations, reminders and any changes — even when
            MakeMyCut is closed.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={handleEnable} disabled={loading}>
          {loading ? 'Enabling…' : 'Enable Notifications'}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss}>Not now</Button>
      </div>
    </div>
  );
};