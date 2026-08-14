ALTER TABLE public.bills REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;