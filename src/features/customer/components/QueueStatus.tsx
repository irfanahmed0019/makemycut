import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QueueStatusProps {
  queueId: string;
  salonName: string;
  initialPosition: number;
  initialWait: number;
  onBack: () => void;
}

export const QueueStatus = ({ queueId, salonName, initialPosition, initialWait, onBack }: QueueStatusProps) => {
  const [position, setPosition] = useState(initialPosition);
  const [estimatedWait, setEstimatedWait] = useState(initialWait);
  const [status, setStatus] = useState<string>('waiting');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchStatus = async () => {
    const { data } = await supabase.from('queues').select('queue_position, status, salon_id').eq('id', queueId).maybeSingle();
    if (!data) return;

    setStatus(data.status);
    if (data.status !== 'waiting' && data.status !== 'serving') return;

    // Count people ahead
    const { count } = await supabase
      .from('queues')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', data.salon_id)
      .in('status', ['waiting', 'serving'])
      .lt('queue_position', data.queue_position);

    const ahead = count || 0;
    setPosition(data.queue_position);

    // Get salon wait time
    const { data: settings } = await supabase.from('salon_settings').select('wait_per_customer').eq('salon_id', data.salon_id).maybeSingle();
    const waitPer = settings?.wait_per_customer || 20;
    setEstimatedWait(ahead * waitPer);
    setLastRefresh(new Date());
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [queueId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`queue-${queueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        fetchStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queueId]);

  const isServed = status === 'served';
  const isRemoved = status === 'removed';

  return (
    <section className="pt-4">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <Button onClick={onBack} size="icon" variant="secondary" className="rounded-full">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center">Queue Status</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 space-y-4 pb-6">
        <Card className="text-center">
          <CardHeader><CardTitle>{salonName}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {isServed ? (
              <div className="space-y-2">
                <span className="material-symbols-outlined text-6xl text-green-500">check_circle</span>
                <h2 className="text-2xl font-bold text-green-500">It's Your Turn!</h2>
                <p className="text-muted-foreground">Please proceed to the salon.</p>
              </div>
            ) : isRemoved ? (
              <div className="space-y-2">
                <span className="material-symbols-outlined text-6xl text-destructive">cancel</span>
                <h2 className="text-2xl font-bold text-destructive">Removed from Queue</h2>
                <p className="text-muted-foreground">You have been removed from the queue.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground text-sm">Your Position</p>
                  <p className="text-6xl font-bold text-primary">#{position}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-muted-foreground text-sm">People Ahead</p>
                    <p className="text-2xl font-bold">{position - 1}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-muted-foreground text-sm">Est. Wait</p>
                    <p className="text-2xl font-bold">{estimatedWait} min</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 30s
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
