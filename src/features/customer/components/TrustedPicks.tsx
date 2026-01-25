import { Button } from '@/components/ui/button';

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

// Only these two salons are shown
const FEATURED_SALONS: Barber[] = [
  {
    id: 'the-barber-shop',
    name: 'The Barber Shop',
    description: 'Classic cuts and modern styles in a premium setting',
    image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400',
    rating: 4.8,
    review_count: 124,
    address: 'MG Road, near Central Mall',
  },
  {
    id: 'urban-edge-studio',
    name: 'Urban Edge Studio',
    description: 'Contemporary grooming experience for the modern gentleman',
    image_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400',
    rating: 4.7,
    review_count: 89,
    address: 'Brigade Road, near Coffee Day Junction',
  },
];

export const TrustedPicks = ({ onBookNow }: TrustedPicksProps) => {
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

  return (
    <section className="pt-4">
      <h2 className="text-2xl font-bold mb-4 text-center">Home</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold mb-4">Featured Salons</h3>
          <div className="space-y-4">
            {FEATURED_SALONS.map(renderBarberCard)}
          </div>
        </div>
      </div>
    </section>
  );
};
