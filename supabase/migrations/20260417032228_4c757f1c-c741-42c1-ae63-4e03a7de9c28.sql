
DROP VIEW IF EXISTS public.queue_public;

CREATE VIEW public.queue_public
WITH (security_invoker = true)
AS
SELECT id, salon_id, queue_position, status, joined_at, service_id
FROM public.queues;

GRANT SELECT ON public.queue_public TO anon, authenticated;
