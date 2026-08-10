import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BellRing } from 'lucide-react';

interface Props {
  salonId: string;
  salonName: string;
}

const tomorrowISO = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TomorrowRemindersCard = ({ salonId, salonName }: Props) => {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const sendReminders = async () => {
    setSending(true);
    try {
      const date = tomorrowISO();
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('user_id')
        .eq('barber_id', salonId)
        .eq('booking_date', date)
        .in('status', ['upcoming', 'CONFIRMED', 'pending']);
      if (error) throw error;

      const userIds = Array.from(new Set((bookings ?? []).map((b) => b.user_id).filter(Boolean)));
      if (userIds.length === 0) {
        toast({ title: 'No bookings tomorrow', description: 'There is nothing to remind anyone about.' });
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('send-push', {
        body: {
          userIds,
          title: 'Your appointment is tomorrow',
          body: `Reminder: you have a booking at ${salonName} tomorrow. See you there!`,
          url: '/',
          notificationType: 'appointment_reminder',
        },
      });
      if (fnError) throw fnError;

      toast({
        title: 'Reminders sent',
        description: `${data?.sent ?? 0} notification(s) delivered to ${userIds.length} customer(s).`,
      });
    } catch (e) {
      toast({
        title: 'Could not send reminders',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Customer Reminders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Send a push notification to every customer who has a booking tomorrow.
        </p>
        <Button onClick={sendReminders} disabled={sending} className="gap-2">
          <BellRing className="w-4 h-4" />
          {sending ? 'Sending…' : "Send tomorrow's reminders"}
        </Button>
      </CardContent>
    </Card>
  );
};