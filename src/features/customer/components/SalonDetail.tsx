import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SalonDetailProps {
  salon: any;
  onBookAppointment: () => void;
  onJoinQueue: () => void;
  onBack: () => void;
}

export const SalonDetail = ({ salon, onBookAppointment, onJoinQueue, onBack }: SalonDetailProps) => {
  const [services, setServices] = useState<any[]>([]);
  const [queueLength, setQueueLength] = useState(0);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: svcData }, { count: queueCount }, { data: settingsData }] = await Promise.all([
        supabase.from('services').select('*').eq('barber_id', salon.id).eq('is_active', true).order('order_index'),
        supabase.from('queues').select('id', { count: 'exact', head: true }).eq('salon_id', salon.id).eq('status', 'waiting'),
        supabase.from('salon_settings').select('*').eq('salon_id', salon.id).maybeSingle(),
      ]);
      setServices(svcData || []);
      setQueueLength(queueCount || 0);
      setSettings(settingsData);
    };
    fetch();
  }, [salon.id]);

  const bookingEnabled = settings?.booking_enabled !== false;
  const queueEnabled = settings?.queue_enabled !== false;

  return (
    <section className="pt-4">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10">
        <Button onClick={onBack} size="icon" variant="secondary" className="rounded-full">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center">{salon.name}</h1>
        <div className="w-10" />
      </header>

      <div className="px-4 space-y-4 pb-6">
        {/* Salon Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <img src={salon.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'} className="w-24 h-24 rounded-lg object-cover" alt={salon.name} />
              <div className="flex-1">
                <h2 className="text-lg font-bold">{salon.name}</h2>
                {salon.address && <p className="text-sm text-muted-foreground">{salon.address}</p>}
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <span className="material-symbols-outlined text-primary text-base">star</span>
                  <span>{salon.rating || 0}</span>
                  <span className="text-muted-foreground">({salon.review_count || 0} reviews)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Info */}
        {queueEnabled && (
          <Card className="bg-card border-primary/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Queue</p>
                <p className="text-2xl font-bold">{queueLength} <span className="text-sm font-normal text-muted-foreground">people waiting</span></p>
              </div>
              <Badge variant="outline" className="text-primary border-primary">{queueLength === 0 ? 'No Wait' : `~${queueLength * (settings?.wait_per_customer || 20)} min`}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {bookingEnabled && (
            <Button onClick={onBookAppointment} className="h-14 text-base font-bold">
              <span className="material-symbols-outlined mr-2">calendar_month</span>
              Book Appointment
            </Button>
          )}
          {queueEnabled && (
            <Button onClick={onJoinQueue} variant="outline" className="h-14 text-base font-bold border-primary text-primary">
              <span className="material-symbols-outlined mr-2">group</span>
              Join Queue
            </Button>
          )}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Services</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {services.map(s => (
                <div key={s.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.duration_minutes} min</p>
                  </div>
                  {s.price > 0 && <p className="font-bold">₹{s.price}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};
