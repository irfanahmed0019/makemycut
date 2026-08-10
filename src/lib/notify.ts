import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'appointment_booked'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_rescheduled'
  | 'appointment_reminder'
  | 'appointment_accepted'
  | 'payment_successful'
  | 'account_update'
  | 'promotion';

interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  url?: string;
  appointmentId?: string;
  notificationType: NotificationType;
}

/**
 * Fire-and-forget push request. The backend performs authorization, preference
 * filtering and delivery — failures must never block the user's flow.
 */
export const sendPush = (input: NotifyInput) => {
  void supabase.functions
    .invoke('send-push', { body: input })
    .catch((e) => console.warn('push dispatch failed', e));
};