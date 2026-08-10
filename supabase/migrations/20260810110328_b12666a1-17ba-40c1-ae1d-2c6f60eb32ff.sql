-- V1: remove booking hard delete
DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;
REVOKE DELETE ON public.bookings FROM authenticated;
REVOKE DELETE ON public.bookings FROM anon;

-- V2: barber_assignments least privilege
DROP POLICY IF EXISTS "Anyone can view barber assignments" ON public.barber_assignments;
REVOKE ALL ON public.barber_assignments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_assignments TO authenticated;
GRANT ALL ON public.barber_assignments TO service_role;

CREATE POLICY "Barbers view own assignment"
ON public.barber_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners and admins view salon assignments"
ON public.barber_assignments FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = barber_assignments.salon_id AND b.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- V3: move UPI out of profiles
CREATE TABLE IF NOT EXISTS public.profile_payment_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  upi_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_payment_details TO authenticated;
GRANT ALL ON public.profile_payment_details TO service_role;

ALTER TABLE public.profile_payment_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payment details"
ON public.profile_payment_details FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profile_payment_details_updated_at
BEFORE UPDATE ON public.profile_payment_details
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.profile_payment_details (user_id, upi_id)
SELECT id, upi_id FROM public.profiles
WHERE upi_id IS NOT NULL AND upi_id <> ''
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS upi_id;