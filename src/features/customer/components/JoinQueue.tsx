import { useState, useEffect, useRef } from 'react';
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
  const [alreadyInQueue, setAlreadyInQueue] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const submitLockRef = useRef(false);

  // Backend is single source of truth
  const fetchStatus = async () => {
    if (!user) return null;
    const { data, error } = await supabase.rpc('get_queue_status', {
      p_user_id: user.id,
      p_salon_id: salon.id,
    });
    if (error || !data || data.length === 0) return null;
    const row = data[0];
    return row.in_queue ? row : null;
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const profilePromise = user
        ? supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null });
      const servicesPromise = supabase
        .from('services').select('*').eq('barber_id', salon.id)
        .eq('is_active', true).order('order_index');
      const statusPromise = user ? fetchStatus() : Promise.resolve(null);

      const [{ data: profile }, { data: serviceRows }, status] = await Promise.all([
        profilePromise, servicesPromise, statusPromise,
      ]);

      if (!isMounted) return;

      if (profile) {
        setName(profile.full_name || '');
        setPhone(profile.phone || '');
      }
      setServices(serviceRows || []);
      if (serviceRows && serviceRows.length > 0) {
        setSelectedService((c) => c || serviceRows[0].id);
      }

      if (status) {
        setAlreadyInQueue(true);
        onJoined(status.queue_id, status.queue_pos, status.estimated_wait || 0);
      }
      setCheckingStatus(false);
    };

    init();
    return () => { isMounted = false; };
  }, [salon.id, user?.id]);

  const handleJoin = async () => {
    // Rapid-click & multi-tab guard
    if (submitLockRef.current || isSubmitting || alreadyInQueue) return;
    submitLockRef.current = true;

    if (!name.trim() || !phone.trim()) {
      submitLockRef.current = false;
      toast({ variant: 'destructive', title: 'Missing Info', description: 'Please enter your name and phone.' });
      return;
    }
    if (!user) {
      submitLockRef.current = false;
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'Please sign in.' });
      return;
    }

    setIsSubmitting(true);

    // Backend join_queue is idempotent — if already in queue, returns existing entry
    const { data, error } = await supabase.rpc('join_queue', {
      p_salon_id: salon.id,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
      p_service_id: selectedService || null,
      p_user_id: user.id,
    });

    setIsSubmitting(false);
    submitLockRef.current = false;

    if (error) {
      let msg = error.message;
      if (msg.includes('QUEUE_DISABLED')) msg = 'Queue is currently disabled.';
      else if (msg.includes('QUEUE_PAUSED')) msg = 'Queue is currently paused.';
      toast({ variant: 'destructive', title: 'Could not join queue', description: msg });
      return;
    }

    if (data && data.length > 0) {
      const r = data[0];
      setAlreadyInQueue(true);
      onJoined(r.queue_id, r.queue_pos, r.estimated_wait);
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

            <Button
              onClick={handleJoin}
              disabled={isSubmitting || alreadyInQueue || checkingStatus}
              className="w-full h-14 text-lg font-bold"
            >
              {checkingStatus ? 'Checking…' : alreadyInQueue ? 'Already in Queue' : isSubmitting ? 'Joining…' : 'Join Queue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
