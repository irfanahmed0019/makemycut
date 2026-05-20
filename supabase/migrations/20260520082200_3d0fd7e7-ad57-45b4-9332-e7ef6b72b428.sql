
-- Remove salon-wide unique constraints that block multi-chair bookings at same time
DROP INDEX IF EXISTS public.idx_bookings_unique_slot;
DROP INDEX IF EXISTS public.idx_slot_holds_unique;

-- Make get_occupied_slots chair-aware (optional chair filter)
CREATE OR REPLACE FUNCTION public.get_occupied_slots(
  p_barber_id uuid,
  p_booking_date date,
  p_chair_id uuid DEFAULT NULL
)
RETURNS TABLE(booking_time time without time zone, chair_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT booking_time, chair_id
  FROM public.bookings
  WHERE barber_id = p_barber_id
    AND booking_date = p_booking_date
    AND status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
    AND (p_chair_id IS NULL OR chair_id = p_chair_id OR chair_id IS NULL);
$$;
