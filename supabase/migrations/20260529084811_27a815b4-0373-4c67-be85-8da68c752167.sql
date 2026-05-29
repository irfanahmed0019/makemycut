-- Allow assigned barbers to view profile details for customers who have bookings on their chair
CREATE POLICY "Barbers can view customer profiles for their chair bookings"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.user_id = profiles.id
      AND b.chair_id IS NOT NULL
      AND b.chair_id = public.current_barber_chair(auth.uid())
  )
);