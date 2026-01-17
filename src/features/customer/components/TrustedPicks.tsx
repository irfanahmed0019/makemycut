import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface Barber {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rating: number;
  review_count: number;
}

interface TrustedPicksProps {
  onBookNow: (barber: Barber) => void;
}

export const TrustedPicks = ({ onBookNow }: TrustedPicksProps) => {
  const [barbers, setBarbers] = useState<Barber[]>([]);

  useEffect(() => {
    fetchBarbers();
  }, []);

  const fetchBarbers = async () => {
    const { data, error } = await supabase
      .from('barbers')
      .select('*')
      .order('rating', { ascending: false });

    if (!error && data) {
      setBarbers(data);
    }
  };

  const renderBarberCard = (barber: Barber) => (
    <div key={barber.id} className="flex items-start gap-4 p-4 rounded-lg bg-card">
      <div className="flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-base font-bold text-card-foreground">{barber.name}</p>
          <p className="text-foreground text-sm">{barber.description}</p>
          <div className="flex items-center gap-1 text-foreground text-sm">
            <span className="material-symbols-outlined text-base text-yellow-400">star</span>
            <span>{barber.rating} ({barber.review_count} reviews)</span>
          </div>
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
        src={barber.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'}
      />
    </div>
  );

  const peoplsChoice = barbers.slice(0, 3);
  const expertsChoice = barbers.slice(3, 6);

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold mb-4 text-center">Home</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-4">People's Choice</h3>
          <div className="space-y-4">
            {peoplsChoice.map(renderBarberCard)}
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-4">Expert's Choice</h3>
          <div className="space-y-4">
            {expertsChoice.map(renderBarberCard)}
          </div>
        </div>
      </div>
    </section>
  );
};
