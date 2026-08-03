-- 1. Remove ambiguous 5-arg overload
DROP FUNCTION IF EXISTS public.join_queue(uuid, text, text, uuid, uuid);

-- 2. Validate caller identity on join_queue
CREATE OR REPLACE FUNCTION public.join_queue(p_salon_id uuid, p_customer_name text, p_customer_phone text, p_service_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_chair_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(queue_id uuid, queue_pos integer, estimated_wait integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pos int; v_queue_id uuid; v_wait_per int; v_ahead int;
  v_existing_id uuid; v_existing_pos int;
  v_enabled boolean; v_paused boolean;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  PERFORM expire_stale_queue_entries();

  SELECT id, queue_position INTO v_existing_id, v_existing_pos
  FROM queues
  WHERE user_id = p_user_id AND salon_id = p_salon_id
    AND status IN ('waiting','serving')
    AND joined_at::date = CURRENT_DATE
  ORDER BY joined_at ASC LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    SELECT count(*)::int INTO v_ahead FROM queues
    WHERE salon_id = p_salon_id
      AND status IN ('waiting','serving')
      AND queue_position < v_existing_pos
      AND joined_at::date = CURRENT_DATE;
    SELECT wait_per_customer INTO v_wait_per FROM salon_settings WHERE salon_id = p_salon_id;
    RETURN QUERY SELECT v_existing_id, v_existing_pos, v_ahead * COALESCE(v_wait_per, 20);
    RETURN;
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
    AND joined_at::date = CURRENT_DATE;

  INSERT INTO queues (salon_id, customer_name, customer_phone, user_id, queue_position, service_id, chair_id)
  VALUES (p_salon_id, p_customer_name, p_customer_phone, p_user_id, v_pos, p_service_id, p_chair_id)
  RETURNING id INTO v_queue_id;

  v_ahead := v_pos - 1;
  RETURN QUERY SELECT v_queue_id, v_pos, v_ahead * v_wait_per;
END;
$function$;

-- 3. Public-safe queue list (first names only, no phone/user ids)
CREATE OR REPLACE FUNCTION public.get_queue_list(p_salon_id uuid)
 RETURNS TABLE(entry_id uuid, queue_position integer, display_name text, status text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT q.id,
         q.queue_position,
         COALESCE(NULLIF(split_part(trim(q.customer_name), ' ', 1), ''), 'Customer'),
         q.status
  FROM queues q
  WHERE q.salon_id = p_salon_id
    AND q.status IN ('waiting','serving')
    AND q.joined_at::date = CURRENT_DATE
  ORDER BY q.queue_position ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_queue_list(uuid) TO anon, authenticated;

-- 4. Editable time slots
CREATE TABLE IF NOT EXISTS public.salon_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  slot_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, slot_time)
);

GRANT SELECT ON public.salon_time_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salon_time_slots TO authenticated;
GRANT ALL ON public.salon_time_slots TO service_role;

ALTER TABLE public.salon_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view salon time slots"
  ON public.salon_time_slots FOR SELECT USING (true);

CREATE POLICY "Owners or admins can insert time slots"
  ON public.salon_time_slots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM barbers b WHERE b.id = salon_id AND b.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners or admins can update time slots"
  ON public.salon_time_slots FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM barbers b WHERE b.id = salon_id AND b.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners or admins can delete time slots"
  ON public.salon_time_slots FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM barbers b WHERE b.id = salon_id AND b.owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_salon_time_slots_updated_at
  BEFORE UPDATE ON public.salon_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default 10:00-17:30 half-hour slots for every existing salon
INSERT INTO public.salon_time_slots (salon_id, slot_time)
SELECT b.id, t::time
FROM public.barbers b
CROSS JOIN generate_series(timestamp '2000-01-01 10:00', timestamp '2000-01-01 17:30', interval '30 minutes') AS t
ON CONFLICT (salon_id, slot_time) DO NOTHING;