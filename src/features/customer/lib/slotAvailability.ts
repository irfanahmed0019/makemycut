import { supabase } from '@/integrations/supabase/client';

// Convert 24h DB time (e.g. "17:00:00") to 12h display (e.g. "5:00 PM")
export const to12h = (t: string): string => {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${suffix}`;
};

// Convert 12h display (e.g. "5:00 PM") to 24h (e.g. "17:00")
export const to24h = (t: string): string => {
  const [timePart, period] = t.split(' ');
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${mStr}`;
};

// Statuses that occupy a slot (prevent double-booking).
// MUST be identical between booking and reschedule flows.
export const OCCUPYING_STATUSES = ['upcoming', 'CONFIRMED', 'ON_HOLD', 'pending', 'completed'];

/**
 * Fetches the set of booked slots (12h display strings) for a given barber/date.
 * Optionally excludes a specific booking id (used during reschedule so the
 * booking being moved doesn't mark its own current slot as taken).
 *
 * Uses a SECURITY DEFINER RPC so it can see bookings from ALL users, not just
 * the current user's (RLS restricts SELECT on bookings to the owner).
 */
export const fetchBookedSlots = async (
  barberId: string,
  dateStr: string,
  excludeBookingId?: string
): Promise<Set<string>> => {
  const { data, error } = await (supabase as any).rpc('get_occupied_slots', {
    p_barber_id: barberId,
    p_booking_date: dateStr,
  });

  const booked = new Set<string>();
  if (error || !data) return booked;

  // If excluding a booking id, also fetch that booking's time so we can remove
  // it from the occupied set (the RPC doesn't know which booking to exclude).
  let excludeTime: string | null = null;
  if (excludeBookingId) {
    const { data: own } = await supabase
      .from('bookings')
      .select('booking_time')
      .eq('id', excludeBookingId)
      .maybeSingle();
    if (own?.booking_time) excludeTime = own.booking_time;
  }

  (data as Array<{ booking_time: string }>).forEach((b) => {
    if (excludeTime && b.booking_time === excludeTime) return;
    booked.add(to12h(b.booking_time));
  });
  return booked;
};

/**
 * Pre-flight check against the DB right before writing. Returns true if the
 * target slot is already occupied by someone else. Never throws — on network
 * error we return false and let the DB constraint catch it as a last resort.
 */
export const isSlotTaken = async (
  barberId: string,
  dateStr: string,
  time24WithSeconds: string,
  excludeBookingId?: string
): Promise<boolean> => {
  const { data, error } = await (supabase as any).rpc('is_slot_occupied', {
    p_barber_id: barberId,
    p_booking_date: dateStr,
    p_booking_time: time24WithSeconds,
    p_exclude_booking_id: excludeBookingId ?? null,
  });
  if (error) return false;
  return data === true;
};