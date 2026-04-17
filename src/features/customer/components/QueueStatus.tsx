import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface QueueStatusProps {
  queueId: string;
  salonName: string;
  initialPosition: number;
  initialWait: number;
  onBack: () => void;
}

export const QueueStatus = ({ queueId, salonName, initialPosition, initialWait, onBack }: QueueStatusProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [position, setPosition] = useState(initialPosition);
  const [estimatedWait, setEstimatedWait] = useState(initialWait);
  const [status, setStatus] = useState<string>('waiting');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [salonId, setSalonId] = useState<string | null>(null);
  const [queueList, setQueueList] = useState<{ position: number; name: string; isMe: boolean }[]>([]);
  const [showList, setShowList] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const maskName = (n: string) => {
    if (!n) return 'Customer';
    const parts = n.trim().split(' ');
    return parts[0] || 'Customer';
  };

  const fetchStatus = async () => {
    const { data } = await supabase.from('queues').select('queue_position, status, salon_id').eq('id', queueId).maybeSingle();
    if (!data) return;

    setStatus(data.status);
    setSalonId(data.salon_id);
    if (data.status !== 'waiting' && data.status !== 'serving') return;

    const { data: rows } = await supabase
      .from('queues')
      .select('id, queue_position, customer_name')
      .eq('salon_id', data.salon_id)
      .in('status', ['waiting', 'serving'])
      .order('queue_position', { ascending: true });

    const list = (rows || []).map(r => ({
      position: r.queue_position,
      name: maskName(r.customer_name),
      isMe: r.id === queueId,
    }));
    setQueueList(list);

    const ahead = (rows || []).filter(r => r.queue_position < data.queue_position).length;
    setPosition(data.queue_position);

    const { data: settings } = await supabase.from('salon_settings').select('wait_per_customer').eq('salon_id', data.salon_id).maybeSingle();
    const waitPer = settings?.wait_per_customer || 20;
    setEstimatedWait(ahead * waitPer);
    setLastRefresh(new Date());
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [queueId]);

  useEffect(() => {
    const channel = supabase
      .channel(`queue-${queueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        fetchStatus();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queueId]);

  const handleLeave = async () => {
    if (!user) return;
    setLeaving(true);

    let updateQuery = supabase
      .from('queues')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('status', ['waiting', 'serving']);

    if (salonId) {
      updateQuery = updateQuery.eq('salon_id', salonId);
    }

    const { error } = await updateQuery;

    setLeaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not leave queue', description: error.message });
      return;
    }
    toast({ title: 'You left the queue' });
    onBack();
  };

  const isServed = status === 'served';
  const isRemoved = status === 'removed';

  return (
    <section className="pt-4">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <Button onClick={onBack} size="icon" variant="secondary" className="rounded-full">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center font-display">Queue Status</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 space-y-4 pb-6">
        <Card className="text-center premium-card">
          <CardHeader><CardTitle className="font-display text-xl">{salonName}</CardTitle></CardHeader>
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
                <p className="text-muted-foreground">You are no longer in this queue.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-muted-foreground text-sm uppercase tracking-wider">Your Position</p>
                  <p className="text-7xl font-bold text-primary mt-1" style={{ textShadow: '0 0 30px hsl(var(--brand-red) / 0.5)' }}>#{position}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/40 border border-border rounded-xl p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider">People Ahead</p>
                    <p className="text-2xl font-bold mt-1">{Math.max(position - 1, 0)}</p>
                  </div>
                  <div className="bg-secondary/40 border border-border rounded-xl p-4">
                    <p className="text-muted-foreground text-xs uppercase tracking-wider">Est. Wait</p>
                    <p className="text-2xl font-bold mt-1">{estimatedWait} <span className="text-sm font-normal">min</span></p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog open={showList} onOpenChange={setShowList}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <span className="material-symbols-outlined mr-2 text-base">groups</span>
                        View Queue
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-display">Queue at {salonName}</DialogTitle></DialogHeader>
                      <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
                        {queueList.length === 0 && <p className="text-muted-foreground text-center py-4">No one in queue</p>}
                        {queueList.map(p => (
                          <div key={p.position} className={`flex items-center gap-3 p-3 rounded-lg border ${p.isMe ? 'bg-primary/10 border-primary' : 'bg-secondary/40 border-border'}`}>
                            <span className="font-bold text-primary w-8">{p.position}.</span>
                            <span className="flex-1">{p.name}</span>
                            {p.isMe && <span className="text-xs text-primary font-semibold uppercase">You</span>}
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" onClick={handleLeave} disabled={leaving} className="flex-1">
                    <span className="material-symbols-outlined mr-2 text-base">logout</span>
                    {leaving ? 'Leaving…' : 'Leave Queue'}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Updated {lastRefresh.toLocaleTimeString()} · auto-refresh 30s
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
