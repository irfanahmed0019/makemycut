CREATE OR REPLACE FUNCTION public.admin_reset_salon_data(p_salon_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_bookings int; v_queues int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  DELETE FROM public.booking_reminders br
   USING public.bookings b
   WHERE br.booking_id = b.id AND b.barber_id = p_salon_id;

  DELETE FROM public.bookings WHERE barber_id = p_salon_id;
  GET DIAGNOSTICS v_bookings = ROW_COUNT;

  DELETE FROM public.queues WHERE salon_id = p_salon_id;
  GET DIAGNOSTICS v_queues = ROW_COUNT;

  DELETE FROM public.slot_holds WHERE barber_id = p_salon_id;

  RETURN jsonb_build_object('bookings', v_bookings, 'queue_entries', v_queues);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_salon_data(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reset_salon_data(uuid) TO authenticated;