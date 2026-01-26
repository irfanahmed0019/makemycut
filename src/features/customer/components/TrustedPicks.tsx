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
}

export const TrustedPicks = ({ onBookNow }: TrustedPicksProps) => {
  const [salons, setSalons] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSalons = async () => {
      const { data, error } = await supabase
        .from('barbers')
        .select('id, name, description, image_url, rating, review_count, address')
        .order('rating', { ascending: false })
        .limit(10);

      if (!error && data) {
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
      setIsLoading(false);
    };

    fetchSalons();
  }, []);
  const renderBarberCard = (barber: Barber) => (
    <div key={barber.id} className="flex items-start gap-4 p-4 rounded-lg bg-card">
      <div className="flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-base font-bold text-card-foreground">{barber.name}</p>
          <p className="text-foreground text-sm">{barber.description}</p>
          {barber.address && (
            <p className="text-muted-foreground text-sm">
              Location: {barber.address}
            </p>
          )}
        </div>
        <Button
          onClick={() => onBookNow(barber)}
          className="bg-primary text-primary-foreground"
        >
          Book Now
        </Button>
      </div>
      <img
        alt={barber.name}
        className="w-28 h-28 object-cover rounded-lg"
        src={barber.image_url}
      />
    </div>
  );

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
          <div className="space-y-4">
            {salons.map(renderBarberCard)}
          </div>
        </div>
      </div>
    </section>
  );
};
