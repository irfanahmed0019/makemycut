
-- ============ SECURITY FIX 1: RPC auth.uid() checks ============
CREATE OR REPLACE FUNCTION public.place_hold(p_barber_id uuid, p_booking_date date, p_booking_time text, p_user_id uuid, p_service_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_active INT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.confirm_hold(p_booking_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(p_barber_id uuid, p_booking_date date, p_booking_time time without time zone, p_user_id uuid, p_service_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id UUID;
  v_hold_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

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
$function$;

-- ============ SECURITY FIX 2: slot_holds RLS - private to owner ============
DROP POLICY IF EXISTS "Holds are viewable by everyone" ON public.slot_holds;
CREATE POLICY "Users see own holds only"
ON public.slot_holds FOR SELECT
USING (auth.uid() = user_id);

-- ============ WARNING FIX: queue policies ============
DROP POLICY IF EXISTS "Authenticated users can view queues" ON public.queues;

CREATE POLICY "Customers see own queue entry"
ON public.queues FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Salon owners see own salon queue"
ON public.queues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbers
    WHERE barbers.id = queues.salon_id AND barbers.owner_id = auth.uid()
  )
);

-- ============ PROFILE: upi_id column + referral_code backfill ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upi_id text;

UPDATE public.profiles
SET referral_code = substring(md5(random()::text), 1, 8)
WHERE referral_code IS NULL OR referral_code = '';
