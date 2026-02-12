
-- Drop existing partial unique index
DROP INDEX IF EXISTS public.idx_bookings_unique_slot;

-- Create new partial unique index for CONFIRMED only
CREATE UNIQUE INDEX idx_bookings_unique_slot
ON public.bookings (barber_id, booking_date, booking_time)
WHERE status = 'CONFIRMED';

-- Update place_hold to become a direct booking function (confirm_booking)
CREATE OR REPLACE FUNCTION public.place_hold(p_barber_id uuid, p_booking_date date, p_booking_time time without time zone, p_user_id uuid, p_service_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_active INT;
BEGIN
  -- Check booking limit (max 2 CONFIRMED future bookings)
  SELECT count(*)::int INTO v_active
  FROM bookings
  WHERE user_id = p_user_id
    AND status = 'CONFIRMED'
    AND booking_date >= CURRENT_DATE;

  IF v_active >= 2 THEN
    RAISE EXCEPTION 'BOOKING_LIMIT';
  END IF;

  -- Direct insert as CONFIRMED (no hold)
  INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, payment_method, payment_status, status, expires_at)
  VALUES (p_user_id, p_barber_id, p_service_id, p_booking_date, p_booking_time::text, 'pay_at_salon', 'pending', 'CONFIRMED', NULL)
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$function$;

-- Clean up any remaining ON_HOLD bookings
DELETE FROM bookings WHERE status = 'ON_HOLD';
