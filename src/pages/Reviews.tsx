import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarberReviews } from '@/components/BarberReviews';

export default function Reviews() {
  const location = useLocation();
  const navigate = useNavigate();
  const barber = location.state?.barber;

  if (!barber) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground mb-4">No barber information found</p>
        <Button onClick={() => navigate('/')}>Go Back</Button>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-background">
      <header className="flex items-center p-4 pb-2 justify-between sticky top-0 bg-background z-10 border-b">
        <Button
          onClick={() => navigate(-1)}
          size="icon"
          variant="secondary"
          className="rounded-full"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Button>
        <h1 className="text-xl font-bold flex-1 text-center">Reviews & Ratings</h1>
        <div className="w-10"></div>
      </header>

      <div className="px-4 py-6">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">Saloon</p>
            <p className="text-lg font-bold">{barber.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined text-base text-primary">star</span>
              <span>{barber.rating}</span>
              <span>|</span>
              <span>{barber.review_count} reviews</span>
            </div>
          </div>
          <img
            src={barber.image_url || 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400'}
            className="w-20 h-20 object-cover rounded-lg"
            alt={barber.name}
          />
        </div>

        <h2 className="text-lg font-bold mb-4">Customer Reviews</h2>
        <BarberReviews barberId={barber.id} />
      </div>
    </section>
  );
}
