
-- Add expires_at column to bookings if not exists
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Drop old unique index
DROP INDEX IF EXISTS public.idx_bookings_unique_slot;

-- Create partial unique index on CONFIRMED and ON_HOLD statuses
CREATE UNIQUE INDEX idx_bookings_unique_slot
ON public.bookings (barber_id, booking_date, booking_time)
WHERE status IN ('CONFIRMED', 'ON_HOLD');

-- Function: Place a hold (atomic, no pre-check)
CREATE OR REPLACE FUNCTION public.place_hold(p_barber_id uuid, p_booking_date date, p_booking_time time, p_user_id uuid, p_service_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_active INT;
BEGIN
  -- Clean expired holds
  DELETE FROM bookings WHERE status = 'ON_HOLD' AND expires_at < now();

  -- Check booking limit (max 2 CONFIRMED future bookings)
  SELECT count(*)::int INTO v_active
  FROM bookings
  WHERE user_id = p_user_id
    AND status = 'CONFIRMED'
    AND booking_date >= CURRENT_DATE;

  IF v_active >= 2 THEN
    RAISE EXCEPTION 'BOOKING_LIMIT';
  END IF;

  -- Remove any existing hold by this user for this barber+date
  DELETE FROM bookings
  WHERE barber_id = p_barber_id
    AND booking_date = p_booking_date
    AND user_id = p_user_id
    AND status = 'ON_HOLD';

  -- Attempt insert (relies on partial unique index)
  INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, payment_method, payment_status, status, expires_at)
  VALUES (p_user_id, p_barber_id, p_service_id, p_booking_date, p_booking_time::text, 'pay_at_salon', 'pending', 'ON_HOLD', now() + INTERVAL '5 minutes')
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;

-- Function: Confirm a hold (atomic)
CREATE OR REPLACE FUNCTION public.confirm_hold(p_booking_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  -- Clean expired holds first
  DELETE FROM bookings WHERE status = 'ON_HOLD' AND expires_at < now();

  UPDATE bookings
  SET status = 'CONFIRMED', expires_at = NULL, updated_at = now()
  WHERE id = p_booking_id
    AND user_id = p_user_id
    AND status = 'ON_HOLD';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'HOLD_EXPIRED';
  END IF;

  RETURN true;
END;
$$;

-- Function: Cancel a booking
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE bookings
  SET status = 'CANCELLED', expires_at = NULL, updated_at = now()
  WHERE id = p_booking_id
    AND user_id = p_user_id
    AND status IN ('CONFIRMED', 'ON_HOLD');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    -- Decrement trust score
    UPDATE profiles
    SET trust_score = GREATEST(trust_score - 1, 0), updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN v_rows > 0;
END;
$$;

-- Update count_active_bookings to use CONFIRMED status
CREATE OR REPLACE FUNCTION public.count_active_bookings(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM bookings
  WHERE user_id = p_user_id
    AND status = 'CONFIRMED'
    AND booking_date >= CURRENT_DATE;
$$;
