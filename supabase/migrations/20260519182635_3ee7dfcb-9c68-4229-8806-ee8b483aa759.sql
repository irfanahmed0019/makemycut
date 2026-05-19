
-- 1. Add 'barber' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'barber';

-- 2. chairs table
CREATE TABLE IF NOT EXISTS public.chairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  chair_number int NOT NULL,
  name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, chair_number)
);

ALTER TABLE public.chairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chairs"
  ON public.chairs FOR SELECT USING (true);

CREATE POLICY "Owners can insert own chairs"
  ON public.chairs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = chairs.salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owners can update own chairs"
  ON public.chairs FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = chairs.salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Owners can delete own chairs"
  ON public.chairs FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = chairs.salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_chairs_updated_at
  BEFORE UPDATE ON public.chairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. barber_assignments
CREATE TABLE IF NOT EXISTS public.barber_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  chair_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_chair_assignment
  ON public.barber_assignments (chair_id)
  WHERE is_active = true AND chair_id IS NOT NULL;

ALTER TABLE public.barber_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view barber assignments"
  ON public.barber_assignments FOR SELECT USING (true);

CREATE POLICY "Owners manage own assignments"
  ON public.barber_assignments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_assignments.salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_assignments.salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_barber_assignments_updated_at
  BEFORE UPDATE ON public.barber_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Helper: current barber's chair
CREATE OR REPLACE FUNCTION public.current_barber_chair(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT chair_id FROM public.barber_assignments
  WHERE user_id = _user_id AND is_active = true AND chair_id IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_barber_salon(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT salon_id FROM public.barber_assignments
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
$$;

-- 5. Add chair_id columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS chair_id uuid;
ALTER TABLE public.queues   ADD COLUMN IF NOT EXISTS chair_id uuid;
ALTER TABLE public.slot_holds ADD COLUMN IF NOT EXISTS chair_id uuid;

-- 6. chair_transfer_requests
CREATE TABLE IF NOT EXISTS public.chair_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL,
  booking_id uuid,
  queue_id uuid,
  from_chair_id uuid NOT NULL,
  to_chair_id uuid NOT NULL,
  from_barber_id uuid NOT NULL,
  to_barber_id uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chair_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transfer parties can view"
  ON public.chair_transfer_requests FOR SELECT
  USING (
    from_barber_id = auth.uid()
    OR to_barber_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = salon_id AND b.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Barbers can create transfer"
  ON public.chair_transfer_requests FOR INSERT
  WITH CHECK (from_barber_id = auth.uid());

CREATE TRIGGER trg_ctr_updated_at
  BEFORE UPDATE ON public.chair_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Extend bookings RLS so assigned barbers can see/update their chair's bookings
CREATE POLICY "Barbers can view their chair bookings"
  ON public.bookings FOR SELECT
  USING (
    chair_id IS NOT NULL
    AND chair_id = public.current_barber_chair(auth.uid())
  );

CREATE POLICY "Barbers can update their chair bookings"
  ON public.bookings FOR UPDATE
  USING (
    chair_id IS NOT NULL
    AND chair_id = public.current_barber_chair(auth.uid())
  );

-- 8. Extend queues RLS so assigned barbers can see/manage their chair's queue
CREATE POLICY "Barbers see their chair queue"
  ON public.queues FOR SELECT TO authenticated
  USING (
    chair_id IS NOT NULL
    AND chair_id = public.current_barber_chair(auth.uid())
  );

CREATE POLICY "Barbers update their chair queue"
  ON public.queues FOR UPDATE
  USING (
    chair_id IS NOT NULL
    AND chair_id = public.current_barber_chair(auth.uid())
  );

-- Allow barbers to view the whole salon's queue (read-only overview)
CREATE POLICY "Barbers see whole salon queue"
  ON public.queues FOR SELECT TO authenticated
  USING (
    salon_id = public.current_barber_salon(auth.uid())
  );

-- 9. Unique slot per chair (allow legacy NULL chair via partial)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_chair_slot
  ON public.bookings (barber_id, chair_id, booking_date, booking_time)
  WHERE chair_id IS NOT NULL
    AND status IN ('upcoming','CONFIRMED','ON_HOLD','pending','completed');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hold_chair_slot
  ON public.slot_holds (barber_id, chair_id, booking_date, booking_time)
  WHERE chair_id IS NOT NULL;

-- 10. Updated RPC: place_hold (chair-aware, back-compat)
CREATE OR REPLACE FUNCTION public.place_hold(
  p_barber_id uuid,
  p_booking_date date,
  p_booking_time text,
  p_user_id uuid,
  p_service_id uuid,
  p_chair_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_active INT;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT count(*)::int INTO v_active
  FROM bookings
  WHERE user_id = p_user_id AND status = 'upcoming' AND booking_date >= CURRENT_DATE;
  IF v_active >= 2 THEN RAISE EXCEPTION 'BOOKING_LIMIT'; END IF;

  INSERT INTO bookings (user_id, barber_id, service_id, chair_id, booking_date, booking_time, payment_method, payment_status, status, expires_at)
  VALUES (p_user_id, p_barber_id, p_service_id, p_chair_id, p_booking_date, p_booking_time::time, 'pay_at_salon', 'pending', 'upcoming', NULL)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;

-- 11. Updated RPC: confirm_booking_from_hold
CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(
  p_barber_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_user_id uuid,
  p_service_id uuid,
  p_chair_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_hold_id UUID;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  DELETE FROM slot_holds WHERE expires_at < now();

  SELECT id INTO v_hold_id FROM slot_holds
    WHERE barber_id = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND user_id = p_user_id
      AND (p_chair_id IS NULL OR chair_id = p_chair_id)
    FOR UPDATE;

  IF v_hold_id IS NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE'; END IF;

  INSERT INTO bookings (user_id, barber_id, service_id, chair_id, booking_date, booking_time, payment_method, payment_status, status)
  VALUES (p_user_id, p_barber_id, p_service_id, p_chair_id, p_booking_date, p_booking_time::text, 'pay_at_salon', 'pending', 'upcoming')
  RETURNING id INTO v_booking_id;

  DELETE FROM slot_holds WHERE id = v_hold_id;
  RETURN v_booking_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;

-- 12. Updated join_queue (chair-aware, position per chair)
CREATE OR REPLACE FUNCTION public.join_queue(
  p_salon_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_service_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_chair_id uuid DEFAULT NULL
) RETURNS TABLE(queue_id uuid, queue_pos int, estimated_wait int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pos int; v_queue_id uuid; v_wait_per int; v_ahead int;
  v_existing_id uuid; v_existing_pos int;
  v_enabled boolean; v_paused boolean;
BEGIN
  PERFORM expire_stale_queue_entries();

  IF p_user_id IS NOT NULL THEN
    SELECT id, queue_position INTO v_existing_id, v_existing_pos
    FROM queues
    WHERE user_id = p_user_id AND salon_id = p_salon_id
      AND status IN ('waiting','serving')
      AND joined_at::date = CURRENT_DATE
      AND (p_chair_id IS NULL OR chair_id = p_chair_id)
    ORDER BY joined_at ASC LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      SELECT count(*)::int INTO v_ahead FROM queues
      WHERE salon_id = p_salon_id
        AND status IN ('waiting','serving')
        AND queue_position < v_existing_pos
        AND (p_chair_id IS NULL OR chair_id = p_chair_id)
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
    AND status IN ('waiting','serving')
    AND joined_at::date = CURRENT_DATE
    AND ((p_chair_id IS NULL AND chair_id IS NULL) OR chair_id = p_chair_id);

  INSERT INTO queues (salon_id, customer_name, customer_phone, user_id, queue_position, service_id, chair_id)
  VALUES (p_salon_id, p_customer_name, p_customer_phone, p_user_id, v_pos, p_service_id, p_chair_id)
  RETURNING id INTO v_queue_id;

  v_ahead := v_pos - 1;
  RETURN QUERY SELECT v_queue_id, v_pos, v_ahead * v_wait_per;
END;
$$;

-- 13. request_chair_transfer
CREATE OR REPLACE FUNCTION public.request_chair_transfer(
  p_booking_id uuid,
  p_queue_id uuid,
  p_to_chair_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from_chair uuid; v_salon uuid; v_to_barber uuid; v_id uuid;
BEGIN
  v_from_chair := public.current_barber_chair(auth.uid());
  IF v_from_chair IS NULL THEN RAISE EXCEPTION 'NOT_A_BARBER'; END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT barber_id INTO v_salon FROM bookings WHERE id = p_booking_id AND chair_id = v_from_chair;
  ELSIF p_queue_id IS NOT NULL THEN
    SELECT salon_id INTO v_salon FROM queues WHERE id = p_queue_id AND chair_id = v_from_chair;
  END IF;
  IF v_salon IS NULL THEN RAISE EXCEPTION 'NOT_OWNED'; END IF;

  SELECT user_id INTO v_to_barber FROM barber_assignments
   WHERE chair_id = p_to_chair_id AND is_active = true LIMIT 1;

  INSERT INTO chair_transfer_requests (salon_id, booking_id, queue_id, from_chair_id, to_chair_id, from_barber_id, to_barber_id)
  VALUES (v_salon, p_booking_id, p_queue_id, v_from_chair, p_to_chair_id, auth.uid(), v_to_barber)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 14. respond_chair_transfer
CREATE OR REPLACE FUNCTION public.respond_chair_transfer(
  p_request_id uuid,
  p_accept boolean
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM chair_transfer_requests WHERE id = p_request_id FOR UPDATE;
  IF r.id IS NULL THEN RETURN false; END IF;
  IF r.status <> 'pending' THEN RETURN false; END IF;

  IF auth.uid() IS DISTINCT FROM r.to_barber_id
     AND NOT EXISTS (SELECT 1 FROM barbers b WHERE b.id = r.salon_id AND b.owner_id = auth.uid())
     AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_accept THEN
    IF r.booking_id IS NOT NULL THEN
      UPDATE bookings SET chair_id = r.to_chair_id, updated_at = now() WHERE id = r.booking_id;
    END IF;
    IF r.queue_id IS NOT NULL THEN
      UPDATE queues SET chair_id = r.to_chair_id, updated_at = now() WHERE id = r.queue_id;
    END IF;
    UPDATE chair_transfer_requests SET status='accepted', updated_at=now() WHERE id = p_request_id;
  ELSE
    UPDATE chair_transfer_requests SET status='rejected', updated_at=now() WHERE id = p_request_id;
  END IF;
  RETURN true;
END;
$$;
