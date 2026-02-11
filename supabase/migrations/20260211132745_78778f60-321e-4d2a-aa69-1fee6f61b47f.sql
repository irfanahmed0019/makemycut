
-- Drop old unique index
DROP INDEX IF EXISTS public.idx_bookings_unique_slot;

-- Create partial unique index that only blocks CONFIRMED and ON_HOLD statuses
CREATE UNIQUE INDEX idx_bookings_unique_slot
ON public.bookings (barber_id, booking_date, booking_time)
WHERE status IN ('upcoming', 'completed');

-- Update confirm_booking_from_hold to insert with status 'upcoming' (CONFIRMED equivalent)
CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(p_barber_id uuid, p_booking_date date, p_booking_time time without time zone, p_user_id uuid, p_service_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_hold_id UUID;
BEGIN
  DELETE FROM slot_holds WHERE expires_at < now();

  SELECT id INTO v_hold_id FROM slot_holds
    WHERE barber_id = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_hold_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, payment_method, payment_status, status)
  VALUES (p_user_id, p_barber_id, p_service_id, p_booking_date, p_booking_time::text, 'pay_at_salon', 'pending', 'upcoming')
  RETURNING id INTO v_booking_id;

  DELETE FROM slot_holds WHERE id = v_hold_id;

  RETURN v_booking_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
