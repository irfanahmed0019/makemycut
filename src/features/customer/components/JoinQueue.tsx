import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface JoinQueueProps {
  salon: { id: string; name: string };
  onJoined: (queueId: string, position: number, estimatedWait: number) => void;
  onBack: () => void;
}

export const JoinQueue = ({ salon, onJoined, onBack }: JoinQueueProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getExistingQueue = async () => {
    if (!user) return null;

    const { data: activeQueues, error } = await supabase
      .from('queues')
      .select('id, queue_position, salon_id, joined_at')
      .eq('user_id', user.id)
      .eq('salon_id', salon.id)
      .in('status', ['waiting', 'serving'])
      .order('queue_position', { ascending: true })
      .order('joined_at', { ascending: true });

    if (error || !activeQueues?.length) return null;

    const existingQueue = activeQueues[0];

    if (activeQueues.length > 1) {
      await supabase
        .from('queues')
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('salon_id', salon.id)
        .in('status', ['waiting', 'serving'])
        .neq('id', existingQueue.id);
    }

    const [{ count: aheadCount }, { data: settings }] = await Promise.all([
      supabase
        .from('queues')
        .select('id', { count: 'exact', head: true })
        .eq('salon_id', salon.id)
        .in('status', ['waiting', 'serving'])
        .lt('queue_position', existingQueue.queue_position),
      supabase.from('salon_settings').select('wait_per_customer').eq('salon_id', salon.id).maybeSingle(),
    ]);

    return {
      queueId: existingQueue.id,
      position: existingQueue.queue_position,
      estimatedWait: (aheadCount || 0) * (settings?.wait_per_customer || 20),
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialState = async () => {
      const profilePromise = user
        ? supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null });
      const servicesPromise = supabase
        .from('services')
        .select('*')
        .eq('barber_id', salon.id)
        .eq('is_active', true)
        .order('order_index');
      const existingQueuePromise = user ? getExistingQueue() : Promise.resolve(null);

      const [{ data: profile }, { data: serviceRows }, existingQueue] = await Promise.all([
        profilePromise,
        servicesPromise,
        existingQueuePromise,
      ]);

      if (!isMounted) return;

      if (profile) {
        setName(profile.full_name || '');
        setPhone(profile.phone || '');
      }

      setServices(serviceRows || []);
      if (serviceRows && serviceRows.length > 0) {
        setSelectedService((current) => current || serviceRows[0].id);
      }

      if (existingQueue) {
        onJoined(existingQueue.queueId, existingQueue.position, existingQueue.estimatedWait);
      }
    };

    loadInitialState();

    return () => {
      isMounted = false;
    };
  }, [salon.id, user?.id]);

  const handleJoin = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please enter your name and phone.' });
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please sign in to join the queue.' });
      return;
    }

    setIsSubmitting(true);

    const existingQueue = await getExistingQueue();
    if (existingQueue) {
      setIsSubmitting(false);
      toast({ title: 'Already in queue', description: 'Showing your current queue status.' });
      onJoined(existingQueue.queueId, existingQueue.position, existingQueue.estimatedWait);
      return;
    }

    const { data, error } = await supabase.rpc('join_queue', {
      p_salon_id: salon.id,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_service_id: selectedService || null,
      p_user_id: user.id,
    });

    setIsSubmitting(false);

    if (error) {
      let msg = error.message;
      if (msg.includes('QUEUE_DISABLED')) msg = 'Queue is currently disabled for this salon.';
      else if (msg.includes('QUEUE_PAUSED')) msg = 'Queue is currently paused.';
      toast({ variant: 'destructive', title: 'Could not join queue', description: msg });
      return;
    }

    if (data && data.length > 0) {
      const result = data[0];
      onJoined(result.queue_id, result.queue_pos, result.estimated_wait);
    }
  };

  return (
    <section className="pt-4">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <Button onClick={onBack} size="icon" variant="secondary" className="rounded-full">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center">Join Queue</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 space-y-4 pb-6">
        <Card>
          <CardHeader><CardTitle>{salon.name}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Your Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" /></div>
            <div><Label>Phone Number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Enter phone number" /></div>

            {services.length > 0 && (
              <div>
                <Label className="mb-2 block">Select Service</Label>
                <div className="space-y-2">
                  {services.map(s => (
                    <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="queue-service" value={s.id} checked={selectedService === s.id} onChange={e => setSelectedService(e.target.value)} className="h-4 w-4" />
                      <div className="flex-1 border border-border rounded-lg p-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.duration_minutes} min{s.price > 0 ? ` · ₹${s.price}` : ''}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleJoin} disabled={isSubmitting} className="w-full h-14 text-lg font-bold">
              {isSubmitting ? 'Joining...' : 'Join Queue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
