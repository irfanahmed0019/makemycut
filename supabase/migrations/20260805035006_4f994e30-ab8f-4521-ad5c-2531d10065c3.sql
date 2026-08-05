CREATE POLICY "Barbers can view their salon bookings"
ON public.bookings FOR SELECT
USING (barber_id IS NOT NULL AND barber_id = public.current_barber_salon(auth.uid()));

CREATE POLICY "Barbers can update their salon bookings"
ON public.bookings FOR UPDATE
USING (barber_id IS NOT NULL AND barber_id = public.current_barber_salon(auth.uid()));

CREATE POLICY "Barbers can view customer profiles for salon bookings"
ON public.profiles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.user_id = profiles.id
    AND b.barber_id = public.current_barber_salon(auth.uid())
));