CREATE OR REPLACE FUNCTION public.admin_delete_salon(p_salon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  DELETE FROM public.booking_reminders br USING public.bookings b
    WHERE br.booking_id = b.id AND b.barber_id = p_salon_id;
  DELETE FROM public.chair_transfer_requests WHERE salon_id = p_salon_id;
  DELETE FROM public.bookings WHERE barber_id = p_salon_id;
  DELETE FROM public.queues WHERE salon_id = p_salon_id;
  DELETE FROM public.slot_holds WHERE barber_id = p_salon_id;
  DELETE FROM public.reviews WHERE barber_id = p_salon_id;
  DELETE FROM public.services WHERE barber_id = p_salon_id;
  DELETE FROM public.salon_time_slots WHERE salon_id = p_salon_id;
  DELETE FROM public.salon_settings WHERE salon_id = p_salon_id;
  DELETE FROM public.barber_assignments WHERE salon_id = p_salon_id;
  DELETE FROM public.chairs WHERE salon_id = p_salon_id;
  DELETE FROM public.barbers WHERE id = p_salon_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_salon(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_salon(uuid) TO authenticated;