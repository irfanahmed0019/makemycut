-- Auto-resequence queue positions when an entry becomes inactive (left/served/removed)
CREATE OR REPLACE FUNCTION public.resequence_queue_positions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_salon_id UUID;
BEGIN
  -- Determine the salon affected
  IF TG_OP = 'DELETE' THEN
    v_salon_id := OLD.salon_id;
  ELSE
    v_salon_id := NEW.salon_id;
    -- Only resequence when status transitions from active to inactive
    IF TG_OP = 'UPDATE' THEN
      IF (OLD.status IN ('waiting','serving')) AND (NEW.status NOT IN ('waiting','serving')) THEN
        NULL; -- proceed
      ELSE
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  -- Renumber remaining active entries for today by joined_at order
  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at ASC) AS new_pos
    FROM public.queues
    WHERE salon_id = v_salon_id
      AND status IN ('waiting','serving')
      AND joined_at::date = CURRENT_DATE
  )
  UPDATE public.queues q
  SET queue_position = o.new_pos,
      updated_at = now()
  FROM ordered o
  WHERE q.id = o.id
    AND q.queue_position IS DISTINCT FROM o.new_pos;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_resequence_queue_on_update ON public.queues;
CREATE TRIGGER trg_resequence_queue_on_update
AFTER UPDATE OF status ON public.queues
FOR EACH ROW
EXECUTE FUNCTION public.resequence_queue_positions();

DROP TRIGGER IF EXISTS trg_resequence_queue_on_delete ON public.queues;
CREATE TRIGGER trg_resequence_queue_on_delete
AFTER DELETE ON public.queues
FOR EACH ROW
EXECUTE FUNCTION public.resequence_queue_positions();

-- One-time normalization for today's queues
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT salon_id FROM public.queues WHERE status IN ('waiting','serving') AND joined_at::date = CURRENT_DATE LOOP
    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY joined_at ASC) AS new_pos
      FROM public.queues
      WHERE salon_id = r.salon_id
        AND status IN ('waiting','serving')
        AND joined_at::date = CURRENT_DATE
    )
    UPDATE public.queues q
    SET queue_position = o.new_pos, updated_at = now()
    FROM ordered o
    WHERE q.id = o.id AND q.queue_position IS DISTINCT FROM o.new_pos;
  END LOOP;
END $$;