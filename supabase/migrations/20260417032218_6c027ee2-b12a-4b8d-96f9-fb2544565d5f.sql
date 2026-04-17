
-- 1. Fix cancel_booking to accept actual statuses used by the app
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INT;
BEGIN
  -- Caller must match
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE bookings
  SET status = 'cancelled', expires_at = NULL, updated_at = now()
  WHERE id = p_booking_id
    AND user_id = p_user_id
    AND status IN ('upcoming', 'CONFIRMED', 'ON_HOLD', 'pending');

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    UPDATE profiles
    SET trust_score = GREATEST(trust_score - 1, 0), updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN v_rows > 0;
END;
$function$;

-- 2. Add leave_queue RPC
CREATE OR REPLACE FUNCTION public.leave_queue(p_queue_id uuid, p_user_id uuid)
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

  UPDATE queues
  SET status = 'removed', updated_at = now()
  WHERE id = p_queue_id
    AND user_id = p_user_id
    AND status IN ('waiting', 'serving');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

-- 3. Tighten queue PII exposure
DROP POLICY IF EXISTS "Anyone can view queues" ON public.queues;

CREATE POLICY "Authenticated users can view queues"
ON public.queues
FOR SELECT
TO authenticated
USING (true);

-- 4. Public-safe view exposing only non-PII for anonymous queue length lookups
CREATE OR REPLACE VIEW public.queue_public AS
SELECT id, salon_id, queue_position, status, joined_at, service_id
FROM public.queues;

GRANT SELECT ON public.queue_public TO anon, authenticated;
