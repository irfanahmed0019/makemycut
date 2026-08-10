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

// Minimum lead time (minutes) before a slot's start for it to remain bookable.
export const SLOT_LEAD_MINUTES = 0;

/**
 * True when a slot on the given date has already started (or is within the
 * lead-time window) relative to `now`. Slots on future dates are never past.
 */
export const isSlotPast = (date: Date, time12h: string, now: Date = new Date()): boolean => {
  const slot = new Date(date);
  const [h, m] = to24h(time12h).split(':').map((n) => parseInt(n, 10));
  slot.setHours(h, m, 0, 0);
  return slot.getTime() - SLOT_LEAD_MINUTES * 60_000 <= now.getTime();
};

// Fallback slots used only when a salon has no configured slots yet.
export const DEFAULT_TIME_SLOTS = [
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
];

/**
 * Salon-configurable bookable times (12h display strings), managed by the
 * salon owner / admin in the dashboard. Falls back to the standard set.
 */
export const fetchSalonTimeSlots = async (salonId: string): Promise<string[]> => {
  const { data, error } = await (supabase as any)
    .from('salon_time_slots')
    .select('slot_time, is_active')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('slot_time');
  if (error || !data || data.length === 0) return DEFAULT_TIME_SLOTS;
  return (data as Array<{ slot_time: string }>).map((r) => to12h(r.slot_time));
};

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
  excludeBookingId?: string,
  chairId?: string | null
): Promise<Set<string>> => {
  const { data, error } = await (supabase as any).rpc('get_occupied_slots', {
    p_barber_id: barberId,
    p_booking_date: dateStr,
    p_chair_id: chairId ?? null,
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