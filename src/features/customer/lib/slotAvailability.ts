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
 */
export const fetchBookedSlots = async (
  barberId: string,
  dateStr: string,
  excludeBookingId?: string
): Promise<Set<string>> => {
  const { data } = await supabase
    .from('bookings')
    .select('id, booking_time')
    .eq('barber_id', barberId)
    .eq('booking_date', dateStr)
    .in('status', OCCUPYING_STATUSES);

  const booked = new Set<string>();
  (data || []).forEach((b: any) => {
    if (excludeBookingId && b.id === excludeBookingId) return;
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
  let query = supabase
    .from('bookings')
    .select('id')
    .eq('barber_id', barberId)
    .eq('booking_date', dateStr)
    .eq('booking_time', time24WithSeconds)
    .in('status', OCCUPYING_STATUSES)
    .limit(1);

  if (excludeBookingId) {
    query = query.neq('id', excludeBookingId);
  }

  const { data, error } = await query;
  if (error) return false;
  return (data?.length || 0) > 0;
};