import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ROWS: {
  key: 'appointment_updates' | 'appointment_reminders' | 'promotions' | 'last_minute_alerts';
  label: string;
  hint: string;
}[] = [
  { key: 'appointment_updates', label: 'Appointment changes', hint: 'Booked, confirmed, cancelled or rescheduled' },
  { key: 'appointment_reminders', label: 'Reminders & check-in', hint: 'Before your slot, and when it is time to head over' },
  { key: 'last_minute_alerts', label: 'Last-minute availability', hint: 'When an earlier slot opens up at your salon' },
  { key: 'promotions', label: 'Offers & promotions', hint: 'Deals from salons near you' },
];

export const NotificationSettings = ({ open, onOpenChange }: Props) => {
  const {
    supported, unsupportedReason, permission, subscribed, prefs,
    loading, checking, error, clearError, enable, disable, updatePref, sendTest,
  } = usePushNotifications();
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);

  const handleEnable = async () => {
    clearError();
    const ok = await enable();
    toast(
      ok
        ? { title: 'Thanks for allowing notifications ;)', description: 'This device will now receive MakeMyCut alerts.' }
        : { variant: 'destructive', title: 'Could not enable notifications' },
    );
  };

  const handleDisable = async () => {
    const ok = await disable();
    if (ok) toast({ title: 'Notifications turned off for this device' });
  };

  const handleTest = async () => {
    setTesting(true);
    const ok = await sendTest();
    setTesting(false);
    if (!ok) toast({ variant: 'destructive', title: 'Test notification failed' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader><DialogTitle>Notifications</DialogTitle></DialogHeader>

        {!supported ? (
          <p className="text-sm text-muted-foreground">{unsupportedReason}</p>
        ) : (
          <div className="space-y-4">
            {!subscribed && (
              <div className="rounded-xl bg-secondary/40 p-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Turn on notifications so you never miss a confirmed slot, a reschedule, or your
                  turn in the queue — even when MakeMyCut is closed.
                </p>
                {permission === 'denied' ? (
                  <p className="text-xs text-destructive">
                    Notifications are blocked for this site. Open your browser's site settings
                    (tap the lock icon in the address bar → Notifications → Allow), then reload
                    this page.
                  </p>
                ) : (
                  <Button className="w-full" onClick={handleEnable} disabled={loading || checking}>
                    {loading ? 'Enabling…' : 'Enable Notifications'}
                  </Button>
                )}
              </div>
            )}

            {subscribed && (
              <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
                <div>
                  <p className="text-sm text-foreground">This device</p>
                  <p className="text-xs text-muted-foreground">Notifications are active</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleDisable} disabled={loading}>Turn off</Button>
              </div>
            )}

            <div className="space-y-1">
              {ROWS.map((row) => (
                <div key={row.key} className="flex items-center justify-between py-2">
                  <div className="pr-4">
                    <p className="text-sm text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                  <Switch
                    checked={prefs[row.key]}
                    disabled={!subscribed}
                    onCheckedChange={(v) => updatePref(row.key, v)}
                    aria-label={row.label}
                  />
                </div>
              ))}
            </div>

            {subscribed && (
              <Button variant="secondary" className="w-full" onClick={handleTest} disabled={testing}>
                {testing ? 'Sending…' : 'Send a test notification'}
              </Button>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};