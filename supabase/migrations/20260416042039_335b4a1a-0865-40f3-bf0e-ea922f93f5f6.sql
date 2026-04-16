
DROP POLICY "Authenticated users can join queue" ON public.queues;
CREATE POLICY "Authenticated users can join queue" ON public.queues FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
