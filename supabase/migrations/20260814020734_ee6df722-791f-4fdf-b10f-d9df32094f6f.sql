DELETE FROM public.booking_reminders WHERE booking_id IN (SELECT id FROM public.bookings WHERE user_id = '967e1eb7-5c62-43c7-b48b-401566d680ca');
DELETE FROM public.bookings WHERE user_id = '967e1eb7-5c62-43c7-b48b-401566d680ca';
DELETE FROM public.notification_preferences WHERE user_id = '967e1eb7-5c62-43c7-b48b-401566d680ca';
DELETE FROM public.profiles WHERE id = '967e1eb7-5c62-43c7-b48b-401566d680ca';