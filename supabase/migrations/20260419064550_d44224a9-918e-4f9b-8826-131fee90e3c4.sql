-- 1. Clean up existing duplicate active queue entries (keep oldest per user+salon)
UPDATE public.queues q
SET status = 'removed', updated_at = now()
WHERE status IN ('waiting', 'serving')
  AND user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.queues q2
    WHERE q2.user_id = q.user_id
      AND q2.salon_id = q.salon_id
      AND q2.status IN ('waiting', 'serving')
      AND q2.id <> q.id
      AND (q2.joined_at < q.joined_at OR (q2.joined_at = q.joined_at AND q2.id < q.id))
  );

-- 2. Enforce uniqueness: one active queue entry per (user_id, salon_id)
DROP INDEX IF EXISTS public.queues_unique_active_user_salon;
CREATE UNIQUE INDEX queues_unique_active_user_salon
  ON public.queues (user_id, salon_id)
  WHERE status IN ('waiting', 'serving') AND user_id IS NOT NULL;

-- 3. Idempotent join_queue
CREATE OR REPLACE FUNCTION public.join_queue(
  p_salon_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_service_id uuid,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(queue_id uuid, queue_pos integer, estimated_wait integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pos INTEGER;
  v_queue_id UUID;
  v_wait_per_customer INTEGER;
  v_service_duration INTEGER;
  v_people_ahead INTEGER;
  v_estimated_wait INTEGER;
  v_queue_enabled BOOLEAN;
  v_queue_paused BOOLEAN;
  v_existing_id UUID;
  v_existing_pos INTEGER;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT id, queue_position INTO v_existing_id, v_existing_pos
    FROM queues
    WHERE user_id = p_user_id
      AND salon_id = p_salon_id
      AND status IN ('waiting', 'serving')
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      SELECT count(*)::int INTO v_people_ahead
      FROM queues
      WHERE salon_id = p_salon_id
        AND status IN ('waiting', 'serving')
        AND queue_position < v_existing_pos;

      SELECT wait_per_customer INTO v_wait_per_customer
      FROM salon_settings WHERE salon_id = p_salon_id;
      v_wait_per_customer := COALESCE(v_wait_per_customer, 20);

      RETURN QUERY SELECT v_existing_id, v_existing_pos, v_people_ahead * v_wait_per_customer;
      RETURN;
    END IF;
  END IF;

  SELECT ss.queue_enabled, ss.queue_paused, ss.wait_per_customer
  INTO v_queue_enabled, v_queue_paused, v_wait_per_customer
  FROM salon_settings ss WHERE ss.salon_id = p_salon_id;

  IF v_queue_enabled IS NOT NULL AND NOT v_queue_enabled THEN
    RAISE EXCEPTION 'QUEUE_DISABLED';
  END IF;
  IF v_queue_paused IS NOT NULL AND v_queue_paused THEN
    RAISE EXCEPTION 'QUEUE_PAUSED';
  END IF;

  v_wait_per_customer := COALESCE(v_wait_per_customer, 20);
  v_pos := get_next_queue_position(p_salon_id);

  BEGIN
    INSERT INTO queues (salon_id, customer_name, customer_phone, user_id, queue_position, service_id)
    VALUES (p_salon_id, p_customer_name, p_customer_phone, p_user_id, v_pos, p_service_id)
    RETURNING id INTO v_queue_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id, queue_position INTO v_queue_id, v_pos
    FROM queues
    WHERE user_id = p_user_id
      AND salon_id = p_salon_id
      AND status IN ('waiting', 'serving')
    ORDER BY joined_at ASC
    LIMIT 1;
  END;

  v_people_ahead := v_pos - 1;

  IF p_service_id IS NOT NULL THEN
    SELECT duration_minutes INTO v_service_duration FROM services WHERE id = p_service_id;
  END IF;

  v_estimated_wait := v_people_ahead * COALESCE(v_service_duration, v_wait_per_customer);

  RETURN QUERY SELECT v_queue_id, v_pos, v_estimated_wait;
END;
$function$;

-- 4. Robust leave_queue: removes ALL active entries for user in that salon
CREATE OR REPLACE FUNCTION public.leave_queue(p_queue_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows INT;
  v_salon_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT salon_id INTO v_salon_id FROM queues WHERE id = p_queue_id;

  IF v_salon_id IS NOT NULL THEN
    UPDATE queues
    SET status = 'removed', updated_at = now()
    WHERE user_id = p_user_id
      AND salon_id = v_salon_id
      AND status IN ('waiting', 'serving');
  ELSE
    UPDATE queues
    SET status = 'removed', updated_at = now()
    WHERE id = p_queue_id
      AND user_id = p_user_id
      AND status IN ('waiting', 'serving');
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

-- 5. Backend single-source-of-truth status
CREATE OR REPLACE FUNCTION public.get_queue_status(p_user_id uuid, p_salon_id uuid)
RETURNS TABLE(
  in_queue boolean,
  queue_id uuid,
  queue_pos integer,
  people_ahead integer,
  queue_length integer,
  estimated_wait integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_pos INTEGER;
  v_ahead INTEGER;
  v_total INTEGER;
  v_wait INTEGER;
BEGIN
  SELECT id, queue_position INTO v_id, v_pos
  FROM queues
  WHERE user_id = p_user_id
    AND salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT count(*)::int INTO v_total
  FROM queues
  WHERE salon_id = p_salon_id AND status IN ('waiting', 'serving');

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::int, NULL::int, v_total, NULL::int;
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_ahead
  FROM queues
  WHERE salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND queue_position < v_pos;

  SELECT wait_per_customer INTO v_wait FROM salon_settings WHERE salon_id = p_salon_id;
  v_wait := v_ahead * COALESCE(v_wait, 20);

  RETURN QUERY SELECT true, v_id, v_pos, v_ahead, v_total, v_wait;
END;
$function$;