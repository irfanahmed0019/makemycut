import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Barber {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rating: number;
  review_count: number;
  address?: string;
}

interface TrustedPicksProps {
  onBookNow: (barber: Barber) => void;
  onViewSalon?: (barber: Barber) => void;
  onJoinQueue?: (barber: Barber) => void;
}

export const TrustedPicks = ({ onBookNow, onViewSalon, onJoinQueue }: TrustedPicksProps) => {
  const [salons, setSalons] = useState<Barber[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSalons = async () => {
      const [{ data }, { data: settingsData }] = await Promise.all([
        supabase.from('barbers').select('id, name, description, image_url, rating, review_count, address').order('rating', { ascending: false }).limit(10),
        supabase.from('salon_settings').select('*'),
      ]);

      if (data) {
        setSalons(data.map(salon => ({
          id: salon.id,
          name: salon.name,
          description: salon.description || '',
          image_url: salon.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400',
          rating: salon.rating || 0,
          review_count: salon.review_count || 0,
          address: salon.address || undefined,
        })));
      }

      const map: Record<string, any> = {};
      settingsData?.forEach((s: any) => { map[s.salon_id] = s; });
      setSettings(map);
      setIsLoading(false);
    };
    fetchSalons();
  }, []);

  const renderBarberCard = (barber: Barber) => {
    const s = settings[barber.id];
    const bookingEnabled = s?.booking_enabled !== false;
    const queueEnabled = s?.queue_enabled !== false;

    return (
      <div key={barber.id} className="flex flex-col gap-3 p-4 rounded-lg bg-card">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-1">
            <p className="text-base font-bold text-card-foreground">{barber.name}</p>
            <p className="text-foreground text-sm">{barber.description}</p>
            {barber.address && <p className="text-muted-foreground text-sm">📍 {barber.address}</p>}
            <div className="flex items-center gap-1 text-sm">
              <span className="material-symbols-outlined text-primary text-base">star</span>
              <span>{barber.rating}</span>
              <span className="text-muted-foreground">({barber.review_count})</span>
            </div>
          </div>
          <img alt={barber.name} className="w-28 h-28 object-cover rounded-lg" src={barber.image_url} />
        </div>
        <div className="flex gap-2">
          {bookingEnabled && (
            <Button onClick={() => onBookNow(barber)} className="flex-1" size="sm">
              <span className="material-symbols-outlined mr-1 text-base">calendar_month</span>
              Book
            </Button>
          )}
          {queueEnabled && onJoinQueue && (
            <Button onClick={() => onJoinQueue(barber)} variant="outline" className="flex-1 border-primary text-primary" size="sm">
              <span className="material-symbols-outlined mr-1 text-base">group</span>
              Join Queue
            </Button>
          )}
          {onViewSalon && (
            <Button onClick={() => onViewSalon(barber)} variant="ghost" size="sm">
              <span className="material-symbols-outlined text-base">info</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <section className="pt-4">
        <h2 className="text-2xl font-bold mb-4 text-center">Home</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold mb-4 text-center">Home</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-4">Featured Salons</h3>
          <div className="space-y-4">{salons.map(renderBarberCard)}</div>
        </div>
      </div>
    </section>
  );
};
