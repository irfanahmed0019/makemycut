CREATE OR REPLACE FUNCTION public.is_slot_occupied(p_barber_id uuid, p_booking_date date, p_booking_time time without time zone, p_exclude_booking_id uuid DEFAULT NULL::uuid, p_chair_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_chairs int;
  v_taken int;
BEGIN
  SELECT count(*)::int INTO v_chairs FROM public.chairs c
   WHERE c.salon_id = p_barber_id AND c.is_active = true;

  -- Specific chair already booked?
  IF p_chair_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b
     WHERE b.barber_id = p_barber_id
       AND b.booking_date = p_booking_date
       AND b.booking_time = p_booking_time
       AND b.chair_id = p_chair_id
       AND b.status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
       AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
  ) THEN
    RETURN true;
  END IF;

  -- Capacity check (covers legacy bookings saved without a chair)
  SELECT count(*)::int INTO v_taken FROM public.bookings b
   WHERE b.barber_id = p_barber_id
     AND b.booking_date = p_booking_date
     AND b.booking_time = p_booking_time
     AND b.status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
     AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id);

  RETURN v_taken >= GREATEST(v_chairs, 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_occupied_slots(p_barber_id uuid, p_booking_date date, p_chair_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(booking_time time without time zone, chair_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cap AS (
    SELECT GREATEST(count(*)::int, 1) AS n
    FROM public.chairs c WHERE c.salon_id = p_barber_id AND c.is_active = true
  ), b AS (
    SELECT bk.booking_time, bk.chair_id
    FROM public.bookings bk
    WHERE bk.barber_id = p_barber_id
      AND bk.booking_date = p_booking_date
      AND bk.status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed')
  )
  SELECT DISTINCT b.booking_time, b.chair_id
  FROM b
  WHERE p_chair_id IS NULL
     OR b.chair_id = p_chair_id
     OR (SELECT count(*) FROM b b2 WHERE b2.booking_time = b.booking_time) >= (SELECT n FROM cap);
$function$;

REVOKE EXECUTE ON FUNCTION public.is_slot_occupied(uuid, date, time without time zone, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_slot_occupied(uuid, date, time without time zone, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date, uuid) TO anon, authenticated;