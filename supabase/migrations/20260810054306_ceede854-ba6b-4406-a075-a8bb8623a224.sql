WITH ranked AS (
  SELECT id, row_number() OVER (
           PARTITION BY barber_id, booking_date, booking_time
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.bookings
  WHERE chair_id IS NULL
    AND status = ANY (ARRAY['upcoming','CONFIRMED','ON_HOLD','pending','completed'])
)
UPDATE public.bookings b
SET status = 'cancelled', updated_at = now()
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

DELETE FROM public.slot_holds a
USING public.slot_holds d
WHERE a.chair_id IS NULL AND d.chair_id IS NULL
  AND a.barber_id = d.barber_id
  AND a.booking_date = d.booking_date
  AND a.booking_time = d.booking_time
  AND a.ctid > d.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_booking_nochair_slot
  ON public.bookings (barber_id, booking_date, booking_time)
  WHERE chair_id IS NULL
    AND status = ANY (ARRAY['upcoming','CONFIRMED','ON_HOLD','pending','completed']);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hold_nochair_slot
  ON public.slot_holds (barber_id, booking_date, booking_time)
  WHERE chair_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON public.bookings (user_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_barber_date ON public.bookings (barber_id, booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_chair_date ON public.bookings (chair_id, booking_date) WHERE chair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queues_salon_status_joined ON public.queues (salon_id, status, joined_at);
CREATE INDEX IF NOT EXISTS idx_queues_user_status ON public.queues (user_id, status);
CREATE INDEX IF NOT EXISTS idx_barber_assignments_user_active ON public.barber_assignments (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_barber ON public.services (barber_id);
CREATE INDEX IF NOT EXISTS idx_chairs_salon ON public.chairs (salon_id);
CREATE INDEX IF NOT EXISTS idx_slot_holds_expires ON public.slot_holds (expires_at);