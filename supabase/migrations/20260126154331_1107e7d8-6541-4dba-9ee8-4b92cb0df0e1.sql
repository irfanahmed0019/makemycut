-- Add RLS policy for salon owners to view customer profiles for their bookings
CREATE POLICY "Salon owners can view customer profiles for their bookings"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    INNER JOIN public.barbers bar ON b.barber_id = bar.id
    WHERE b.user_id = profiles.id
    AND bar.owner_id = auth.uid()
  )
);