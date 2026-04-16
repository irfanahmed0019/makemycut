import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

interface OwnerQueueTabProps {
  barberId: string;
}

export const OwnerQueueTab = ({ barberId }: OwnerQueueTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queue, setQueue] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('queues')
      .select('*, services:service_id(name, duration_minutes)')
      .eq('salon_id', barberId)
      .in('status', ['waiting', 'serving'])
      .order('queue_position', { ascending: true });
    setQueue(data || []);
    setIsLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('salon_settings').select('*').eq('salon_id', barberId).maybeSingle();
    setSettings(data);
  };

  useEffect(() => {
    fetchQueue();
    fetchSettings();
    // Realtime
    const channel = supabase
      .channel(`owner-queue-${barberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `salon_id=eq.${barberId}` }, () => fetchQueue())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [barberId]);

  const handleMarkServed = async (queueId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc('mark_queue_served', { p_queue_id: queueId, p_owner_id: user.id });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    fetchQueue();
    toast({ title: 'Customer marked as served' });
  };

  const handleRemove = async (queueId: string) => {
    await supabase.from('queues').update({ status: 'removed' }).eq('id', queueId);
    fetchQueue();
    toast({ title: 'Customer removed' });
  };

  const handleTogglePause = async () => {
    if (!settings) return;
    const newVal = !settings.queue_paused;
    await supabase.from('salon_settings').update({ queue_paused: newVal }).eq('salon_id', barberId);
    setSettings({ ...settings, queue_paused: newVal });
    toast({ title: newVal ? 'Queue Paused' : 'Queue Resumed' });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading queue...</div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Queue Status</p>
            <p className="text-sm text-muted-foreground">{settings?.queue_paused ? 'Paused' : 'Active'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">{settings?.queue_paused ? 'Paused' : 'Active'}</span>
            <Switch checked={!settings?.queue_paused} onCheckedChange={handleTogglePause} />
          </div>
        </CardContent>
      </Card>

      <h3 className="font-bold text-lg">Live Queue ({queue.length})</h3>

      {queue.length === 0 && <p className="text-muted-foreground text-center py-8">No customers in queue</p>}

      {queue.map(q => (
        <Card key={q.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold">#{q.queue_position} — {q.customer_name}</p>
                <p className="text-sm text-muted-foreground">{q.customer_phone}</p>
                <p className="text-sm text-muted-foreground">{q.services?.name || 'No service'} {q.services?.duration_minutes ? `· ${q.services.duration_minutes} min` : ''}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleMarkServed(q.id)}>Served</Button>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(q.id)}>Remove</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
