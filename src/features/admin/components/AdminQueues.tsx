import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export const AdminQueues = () => {
  const [queues, setQueues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchQueues = async () => {
    const { data } = await supabase
      .from('queues')
      .select('*, barbers:salon_id(name), services:service_id(name)')
      .in('status', ['waiting', 'serving'])
      .order('queue_position', { ascending: true });
    setQueues(data || []);
    setIsLoading(false);
  };

  useEffect(() => { fetchQueues(); }, []);

  const handleMarkServed = async (id: string) => {
    await supabase.from('queues').update({ status: 'served', served_at: new Date().toISOString() }).eq('id', id);
    fetchQueues();
    toast({ title: 'Marked as served' });
  };

  const handleRemove = async (id: string) => {
    await supabase.from('queues').update({ status: 'removed' }).eq('id', id);
    fetchQueues();
    toast({ title: 'Removed from queue' });
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading queue...</div>;

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-lg font-bold">Active Queue Entries ({queues.length})</h3>
      {queues.length === 0 && <p className="text-muted-foreground text-center py-8">No active queue entries</p>}
      {queues.map(q => (
        <Card key={q.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">#{q.queue_position} — {q.customer_name}</p>
                <p className="text-sm text-muted-foreground">{q.barbers?.name} · {q.services?.name || 'No service'}</p>
                <p className="text-sm text-muted-foreground">{q.customer_phone}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge>{q.status}</Badge>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => handleMarkServed(q.id)}>Served</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleRemove(q.id)}>Remove</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
