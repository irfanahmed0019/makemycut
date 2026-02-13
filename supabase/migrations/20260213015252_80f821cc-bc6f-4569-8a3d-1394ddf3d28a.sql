
-- Drop the OLD overload that takes TIME parameter and uses 'CONFIRMED' status
DROP FUNCTION IF EXISTS public.place_hold(uuid, date, time, uuid, uuid);

-- Also drop and recreate the TEXT version to be sure it's correct
DROP FUNCTION IF EXISTS public.place_hold(uuid, date, text, uuid, uuid);

CREATE OR REPLACE FUNCTION public.place_hold(
  p_barber_id UUID,
  p_booking_date DATE,
  p_booking_time TEXT,
  p_user_id UUID,
  p_service_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_active INT;
BEGIN
  SELECT count(*)::int INTO v_active
  FROM bookings
  WHERE user_id = p_user_id
    AND status = 'upcoming'
    AND booking_date >= CURRENT_DATE;

  IF v_active >= 2 THEN
    RAISE EXCEPTION 'BOOKING_LIMIT';
  END IF;

  INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, payment_method, payment_status, status, expires_at)
  VALUES (p_user_id, p_barber_id, p_service_id, p_booking_date, p_booking_time::time, 'pay_at_salon', 'pending', 'upcoming', NULL)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
