CREATE UNIQUE INDEX idx_bookings_unique_slot 
ON public.bookings (barber_id, booking_date, booking_time) 
WHERE status IN ('upcoming', 'completed');