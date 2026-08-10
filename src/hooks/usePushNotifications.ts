import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkPushSupport,
  enablePushNotifications,
  disablePushNotifications,
  getExistingSubscription,
  resyncSubscription,
} from '@/lib/push';

export interface NotificationPrefs {
  appointment_updates: boolean;
  appointment_reminders: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  appointment_updates: true,
  appointment_reminders: true,
  promotions: false,
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const support = checkPushSupport();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  // `subscribed` is true only when a live browser subscription exists AND the
  // backend has a matching row — never optimistic.
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
      const sub = await getExistingSubscription();
      if (!sub || !user) { setSubscribed(false); return; }
      const { data } = await (supabase as any)
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', sub.endpoint)
        .eq('is_active', true)
        .maybeSingle();
      setSubscribed(Boolean(data));
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('notification_preferences')
        .select('appointment_updates, appointment_reminders, promotions')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setPrefs(data as NotificationPrefs);
    })();
  }, [user]);

  // The service worker asks us to re-register when the browser rotates a subscription.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') void resyncSubscription();
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  const enable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await enablePushNotifications();
      setPermission(Notification.permission);
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
      setSubscribed(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await disablePushNotifications();
      setSubscribed(false);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn off notifications.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error: err } = await (supabase as any)
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
    if (err) {
      setPrefs(prefs);
      setError('Could not save your preference.');
    }
  }, [prefs, user]);

  const sendTest = useCallback(async () => {
    if (!user) return false;
    const { data, error: err } = await supabase.functions.invoke('send-push', {
      body: {
        userId: user.id,
        title: 'MakeMyCut',
        body: 'Notifications are on. We will keep you posted about your appointments.',
        url: '/',
        notificationType: 'test',
      },
    });
    if (err || !data?.ok) { setError('Test notification failed to send.'); return false; }
    return true;
  }, [user]);

  return {
    supported: support.supported,
    unsupportedReason: support.reason,
    permission,
    subscribed,
    prefs,
    loading,
    checking,
    error,
    clearError: () => setError(null),
    enable,
    disable,
    updatePref,
    sendTest,
    refresh,
  };
};