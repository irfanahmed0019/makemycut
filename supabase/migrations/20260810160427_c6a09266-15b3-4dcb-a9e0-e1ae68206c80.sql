CREATE OR REPLACE FUNCTION public.get_occupied_slots(p_barber_id uuid, p_booking_date date, p_chair_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(booking_time time without time zone, chair_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.booking_time, b.chair_id
  FROM public.bookings b
  WHERE b.barber_id = p_barber_id
    AND b.booking_date = p_booking_date
    AND b.status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
    AND (
      p_chair_id IS NULL
      OR b.chair_id = p_chair_id
      OR (b.chair_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.chairs c WHERE c.salon_id = p_barber_id AND c.is_active = true))
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_slot_occupied(p_barber_id uuid, p_booking_date date, p_booking_time time without time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid, p_chair_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.barber_id = p_barber_id
      AND b.booking_date = p_booking_date
      AND b.booking_time = p_booking_time
      AND b.status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
      AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
      AND (
        p_chair_id IS NULL
        OR b.chair_id = p_chair_id
        OR (b.chair_id IS NULL AND NOT EXISTS (
              SELECT 1 FROM public.chairs c WHERE c.salon_id = p_barber_id AND c.is_active = true))
      )
  );
$function$;

DROP FUNCTION IF EXISTS public.is_slot_occupied(uuid, date, time without time zone, uuid);
DROP FUNCTION IF EXISTS public.get_occupied_slots(uuid, date);

GRANT EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_slot_occupied(uuid, date, time without time zone, uuid, uuid) TO anon, authenticated;