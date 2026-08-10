CREATE TABLE public.booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  offset_minutes integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, offset_minutes)
);

GRANT SELECT ON public.booking_reminders TO authenticated;
GRANT ALL ON public.booking_reminders TO service_role;

ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own booking reminders"
ON public.booking_reminders FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

CREATE INDEX idx_booking_reminders_booking ON public.booking_reminders(booking_id);