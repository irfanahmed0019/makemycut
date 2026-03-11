
-- Add missing CHECK constraints (skip bookings_status_check which already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_status_check') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'refunded'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_method_check') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_method_check CHECK (payment_method IN ('pay_at_salon', 'online'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_check') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barbers_rating_check') THEN
    ALTER TABLE public.barbers ADD CONSTRAINT barbers_rating_check CHECK (rating >= 0 AND rating <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_trust_score_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_trust_score_check CHECK (trust_score >= 0);
  END IF;
END $$;
