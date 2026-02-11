
-- Update default trust_score to 10
ALTER TABLE public.profiles ALTER COLUMN trust_score SET DEFAULT 10;

-- Update existing rows with 0 trust_score to 10
UPDATE public.profiles SET trust_score = 10 WHERE trust_score = 0 OR trust_score IS NULL;

-- Function: decrement trust score on cancellation (-1)
CREATE OR REPLACE FUNCTION public.decrement_trust_on_cancel(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET trust_score = GREATEST(trust_score - 1, 0),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Function: decrement trust score on no-show (-2)
CREATE OR REPLACE FUNCTION public.decrement_trust_on_noshow(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET trust_score = GREATEST(trust_score - 2, 0),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Function: count active bookings for a user
CREATE OR REPLACE FUNCTION public.count_active_bookings(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM bookings
  WHERE user_id = p_user_id
    AND status IN ('upcoming')
    AND booking_date >= CURRENT_DATE;
$$;
