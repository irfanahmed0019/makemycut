
-- Slot holds table for temporary reservations
CREATE TABLE public.slot_holds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '3 minutes'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one hold per slot
CREATE UNIQUE INDEX idx_slot_holds_unique ON public.slot_holds (barber_id, booking_date, booking_time);

-- Enable RLS
ALTER TABLE public.slot_holds ENABLE ROW LEVEL SECURITY;

-- Everyone can see holds (needed to grey out slots)
CREATE POLICY "Holds are viewable by everyone" ON public.slot_holds FOR SELECT USING (true);

-- Users can create their own holds
CREATE POLICY "Users can create holds" ON public.slot_holds FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own holds
CREATE POLICY "Users can delete own holds" ON public.slot_holds FOR DELETE USING (auth.uid() = user_id);

-- Function to clean expired holds
CREATE OR REPLACE FUNCTION public.clean_expired_holds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.slot_holds WHERE expires_at < now();
$$;

-- Function to atomically confirm a booking from a hold
CREATE OR REPLACE FUNCTION public.confirm_booking_from_hold(
  p_barber_id UUID,
  p_booking_date DATE,
  p_booking_time TIME,
  p_user_id UUID,
  p_service_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id UUID;
  v_hold_id UUID;
BEGIN
  -- Clean expired holds first
  DELETE FROM slot_holds WHERE expires_at < now();

  -- Check hold belongs to this user
  SELECT id INTO v_hold_id FROM slot_holds
    WHERE barber_id = p_barber_id
      AND booking_date = p_booking_date
      AND booking_time = p_booking_time
      AND user_id = p_user_id
    FOR UPDATE;

  IF v_hold_id IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  -- Insert booking
  INSERT INTO bookings (user_id, barber_id, service_id, booking_date, booking_time, payment_method, payment_status, status)
  VALUES (p_user_id, p_barber_id, p_service_id, p_booking_date, p_booking_time::text, 'pay_at_salon', 'pending', 'upcoming')
  RETURNING id INTO v_booking_id;

  -- Remove the hold
  DELETE FROM slot_holds WHERE id = v_hold_id;

  RETURN v_booking_id;
END;
$$;
