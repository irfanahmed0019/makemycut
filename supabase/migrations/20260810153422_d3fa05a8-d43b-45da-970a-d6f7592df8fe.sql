GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_barber_salon(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_barber_chair(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.count_active_bookings(uuid) TO authenticated;