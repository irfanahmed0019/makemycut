
-- Create salon_settings table
CREATE TABLE public.salon_settings (
  salon_id UUID PRIMARY KEY REFERENCES public.barbers(id) ON DELETE CASCADE,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '21:00',
  slot_duration INTEGER NOT NULL DEFAULT 30,
  wait_per_customer INTEGER NOT NULL DEFAULT 20,
  queue_enabled BOOLEAN NOT NULL DEFAULT true,
  booking_enabled BOOLEAN NOT NULL DEFAULT true,
  queue_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salon_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view salon settings" ON public.salon_settings FOR SELECT USING (true);
CREATE POLICY "Owners can update own salon settings" ON public.salon_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = salon_settings.salon_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Owners can insert own salon settings" ON public.salon_settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = salon_settings.salon_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all salon settings" ON public.salon_settings FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_salon_settings_updated_at BEFORE UPDATE ON public.salon_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create queues table
CREATE TABLE public.queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  queue_position INTEGER NOT NULL,
  service_id UUID REFERENCES public.services(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'served', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  served_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view queues" ON public.queues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join queue" ON public.queues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own queue entry" ON public.queues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Salon owners can manage their queue" ON public.queues FOR UPDATE USING (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = queues.salon_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Salon owners can delete from their queue" ON public.queues FOR DELETE USING (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = queues.salon_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all queues" ON public.queues FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_queues_updated_at BEFORE UPDATE ON public.queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for queues
ALTER PUBLICATION supabase_realtime ADD TABLE public.queues;

-- Add columns to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'admin';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Allow salon owners to manage their own services
CREATE POLICY "Owners can insert own services" ON public.services FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = services.barber_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Owners can update own services" ON public.services FOR UPDATE USING (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = services.barber_id AND barbers.owner_id = auth.uid())
);
CREATE POLICY "Owners can delete own services" ON public.services FOR DELETE USING (
  EXISTS (SELECT 1 FROM barbers WHERE barbers.id = services.barber_id AND barbers.owner_id = auth.uid())
);

-- Function to get next queue position
CREATE OR REPLACE FUNCTION public.get_next_queue_position(p_salon_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(queue_position), 0) + 1
  FROM queues
  WHERE salon_id = p_salon_id
    AND status IN ('waiting', 'serving')
    AND joined_at::date = CURRENT_DATE;
$$;

-- Function to join queue atomically
CREATE OR REPLACE FUNCTION public.join_queue(
  p_salon_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_service_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(queue_id UUID, queue_pos INTEGER, estimated_wait INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos INTEGER;
  v_queue_id UUID;
  v_wait_per_customer INTEGER;
  v_service_duration INTEGER;
  v_people_ahead INTEGER;
  v_estimated_wait INTEGER;
  v_queue_enabled BOOLEAN;
  v_queue_paused BOOLEAN;
BEGIN
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

  INSERT INTO queues (salon_id, customer_name, customer_phone, user_id, queue_position, service_id)
  VALUES (p_salon_id, p_customer_name, p_customer_phone, p_user_id, v_pos, p_service_id)
  RETURNING id INTO v_queue_id;

  v_people_ahead := v_pos - 1;
  
  IF p_service_id IS NOT NULL THEN
    SELECT duration_minutes INTO v_service_duration FROM services WHERE id = p_service_id;
  END IF;

  v_estimated_wait := v_people_ahead * COALESCE(v_service_duration, v_wait_per_customer);

  RETURN QUERY SELECT v_queue_id, v_pos, v_estimated_wait;
END;
$$;

-- Function to mark customer as served
CREATE OR REPLACE FUNCTION public.mark_queue_served(p_queue_id UUID, p_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
  v_rows INT;
BEGIN
  SELECT salon_id INTO v_salon_id FROM queues WHERE id = p_queue_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM barbers WHERE id = v_salon_id AND owner_id = p_owner_id
  ) AND NOT has_role(p_owner_id, 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  UPDATE queues SET status = 'served', served_at = now() WHERE id = p_queue_id AND status IN ('waiting', 'serving');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  
  RETURN v_rows > 0;
END;
$$;

-- Insert default salon_settings for existing barbers
INSERT INTO salon_settings (salon_id)
SELECT id FROM barbers
ON CONFLICT (salon_id) DO NOTHING;
