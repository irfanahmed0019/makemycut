import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
}

interface BarberReviewsProps {
  barberId: string;
}

export const BarberReviews = ({ barberId }: BarberReviewsProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, [barberId]);

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('barber_id', barberId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No reviews yet. Be the first to review!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="bg-card rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <span
                  key={i}
                  className={`material-symbols-outlined text-lg ${
                    i < review.rating ? 'text-yellow-400' : 'text-gray-600'
                  }`}
                >
                  star
                </span>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {format(new Date(review.created_at), 'MMM dd, yyyy')}
            </span>
          </div>
          {review.comment && (
            <p className="text-sm text-foreground">{review.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
};
