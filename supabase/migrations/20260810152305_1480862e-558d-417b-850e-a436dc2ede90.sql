-- 1. Lock down EXECUTE on all SECURITY DEFINER functions in public (default is PUBLIC)

-- Trigger-only / internal helpers: no client access at all.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resequence_queue_positions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.barbers_normalize_slugs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clean_expired_holds() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_queue_entries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_queue_position(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_trust_on_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_trust_on_noshow(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_active_bookings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_barber_chair(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_barber_salon(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.clean_expired_holds() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_queue_entries() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_next_queue_position(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_trust_on_cancel(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_trust_on_noshow(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_active_bookings(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_barber_chair(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_barber_salon(uuid) TO service_role;

-- Signed-in-only actions: every one of these already enforces auth.uid() internally.
REVOKE ALL ON FUNCTION public.place_hold(uuid, date, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_hold(uuid, date, text, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_hold(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_booking_from_hold(uuid, date, time, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_booking_from_hold(uuid, date, time, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_queue(uuid, text, text, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_queue(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_queue_served(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_chair_transfer(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_chair_transfer(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_queue_status(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_hold(uuid, date, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_hold(uuid, date, text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_hold(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking_from_hold(uuid, date, time, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_booking_from_hold(uuid, date, time, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_queue(uuid, text, text, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_queue(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_queue_served(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_chair_transfer(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_chair_transfer(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_queue_status(uuid, uuid) TO authenticated, service_role;

-- Public, non-PII availability lookups stay open so signed-out discovery works.
REVOKE ALL ON FUNCTION public.get_occupied_slots(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_occupied_slots(uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_slot_occupied(uuid, date, time, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_queue_list(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_occupied_slots(uuid, date, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_slot_occupied(uuid, date, time, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_queue_list(uuid) TO anon, authenticated, service_role;

-- 2. Avatars: readable only by the owner (bucket is switched to private separately).
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Users can read their own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);