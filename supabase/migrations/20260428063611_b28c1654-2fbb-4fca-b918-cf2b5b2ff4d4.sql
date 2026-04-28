
CREATE OR REPLACE FUNCTION public.get_occupied_slots(
  p_barber_id uuid,
  p_booking_date date
)
RETURNS TABLE(booking_time time)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT booking_time
  FROM public.bookings
  WHERE barber_id = p_barber_id
    AND booking_date = p_booking_date
    AND status IN ('upcoming', 'CONFIRMED', 'ON_HOLD', 'pending', 'completed');
$$;

GRANT EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_slot_occupied(
  p_barber_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE barber_id = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND status IN ('upcoming', 'CONFIRMED', 'ON_HOLD', 'pending', 'completed')
      AND (p_exclude_booking_id IS NULL OR id <> p_exclude_booking_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_slot_occupied(uuid, date, time, uuid) TO anon, authenticated;
