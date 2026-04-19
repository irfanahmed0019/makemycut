
-- 1. Clean up stale active entries from previous days (using existing 'removed' status)
UPDATE public.queues
SET status = 'removed', updated_at = now()
WHERE status IN ('waiting', 'serving')
  AND joined_at::date < CURRENT_DATE;

-- 2. Enforce uniqueness: one active entry per (user, salon)
DROP INDEX IF EXISTS public.queues_unique_active_user_salon;
CREATE UNIQUE INDEX queues_unique_active_user_salon
  ON public.queues (user_id, salon_id)
  WHERE status IN ('waiting', 'serving') AND user_id IS NOT NULL;

-- 3. Helper that auto-clears stale rows
CREATE OR REPLACE FUNCTION public.expire_stale_queue_entries()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.queues
  SET status = 'removed', updated_at = now()
  WHERE status IN ('waiting', 'serving')
    AND joined_at::date < CURRENT_DATE;
$$;

-- 4. Idempotent join_queue with stale cleanup and date scoping
CREATE OR REPLACE FUNCTION public.join_queue(
  p_salon_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_service_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(queue_id uuid, queue_pos integer, estimated_wait integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos INTEGER;
  v_queue_id UUID;
  v_wait_per INTEGER;
  v_ahead INTEGER;
  v_existing_id UUID;
  v_existing_pos INTEGER;
  v_enabled BOOLEAN;
  v_paused BOOLEAN;
BEGIN
  PERFORM expire_stale_queue_entries();

  IF p_user_id IS NOT NULL THEN
    SELECT id, queue_position INTO v_existing_id, v_existing_pos
    FROM queues
    WHERE user_id = p_user_id
      AND salon_id = p_salon_id
      AND status IN ('waiting', 'serving')
      AND joined_at::date = CURRENT_DATE
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      SELECT count(*)::int INTO v_ahead
      FROM queues
      WHERE salon_id = p_salon_id
        AND status IN ('waiting', 'serving')
        AND queue_position < v_existing_pos
        AND joined_at::date = CURRENT_DATE;

      SELECT wait_per_customer INTO v_wait_per FROM salon_settings WHERE salon_id = p_salon_id;
      v_wait_per := COALESCE(v_wait_per, 20);

      RETURN QUERY SELECT v_existing_id, v_existing_pos, v_ahead * v_wait_per;
      RETURN;
    END IF;
  END IF;

  SELECT queue_enabled, queue_paused, wait_per_customer
  INTO v_enabled, v_paused, v_wait_per
  FROM salon_settings WHERE salon_id = p_salon_id;

  IF v_enabled IS NOT NULL AND NOT v_enabled THEN RAISE EXCEPTION 'QUEUE_DISABLED'; END IF;
  IF v_paused IS NOT NULL AND v_paused THEN RAISE EXCEPTION 'QUEUE_PAUSED'; END IF;
  v_wait_per := COALESCE(v_wait_per, 20);

  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO v_pos
  FROM queues
  WHERE salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND joined_at::date = CURRENT_DATE;

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

  v_ahead := v_pos - 1;
  RETURN QUERY SELECT v_queue_id, v_pos, v_ahead * v_wait_per;
END;
$$;

-- 5. get_queue_status with stale cleanup + date scoping
CREATE OR REPLACE FUNCTION public.get_queue_status(p_user_id uuid, p_salon_id uuid)
RETURNS TABLE(in_queue boolean, queue_id uuid, queue_pos integer, people_ahead integer, queue_length integer, estimated_wait integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID; v_pos INTEGER; v_ahead INTEGER; v_total INTEGER; v_wait INTEGER;
BEGIN
  PERFORM expire_stale_queue_entries();

  SELECT id, queue_position INTO v_id, v_pos
  FROM queues
  WHERE user_id = p_user_id
    AND salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND joined_at::date = CURRENT_DATE
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT count(*)::int INTO v_total
  FROM queues
  WHERE salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND joined_at::date = CURRENT_DATE;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::int, NULL::int, v_total, NULL::int;
    RETURN;
  END IF;

  SELECT count(*)::int INTO v_ahead
  FROM queues
  WHERE salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND queue_position < v_pos
    AND joined_at::date = CURRENT_DATE;

  SELECT wait_per_customer INTO v_wait FROM salon_settings WHERE salon_id = p_salon_id;
  v_wait := v_ahead * COALESCE(v_wait, 20);

  RETURN QUERY SELECT true, v_id, v_pos, v_ahead, v_total, v_wait;
END;
$$;

-- 6. leave_queue: idempotent — removes ALL active entries for this user at this salon
CREATE OR REPLACE FUNCTION public.leave_queue(p_queue_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
  v_salon_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT salon_id INTO v_salon_id FROM queues WHERE id = p_queue_id;

  IF v_salon_id IS NULL THEN
    SELECT salon_id INTO v_salon_id
    FROM queues
    WHERE user_id = p_user_id AND status IN ('waiting', 'serving')
    ORDER BY joined_at DESC LIMIT 1;
  END IF;

  IF v_salon_id IS NULL THEN RETURN false; END IF;

  UPDATE queues
  SET status = 'removed', updated_at = now()
  WHERE user_id = p_user_id
    AND salon_id = v_salon_id
    AND status IN ('waiting', 'serving');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- 7. get_next_queue_position already filters by date — keep as-is, no change needed
