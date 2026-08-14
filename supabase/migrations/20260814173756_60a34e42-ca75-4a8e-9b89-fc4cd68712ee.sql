
-- helper: is the user staff of this salon?
CREATE OR REPLACE FUNCTION public.is_salon_staff(_user_id uuid, _salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = _salon_id AND b.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.barber_assignments a
                  WHERE a.salon_id = _salon_id AND a.user_id = _user_id AND a.is_active = true);
$$;

CREATE TABLE public.walk_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  chair_id uuid,
  barber_id uuid,
  customer_name text,
  customer_phone text,
  service_id uuid NOT NULL REFERENCES public.services(id),
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_walk_ins_salon_day ON public.walk_ins (salon_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.walk_ins TO authenticated;
GRANT ALL ON public.walk_ins TO service_role;
ALTER TABLE public.walk_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salon staff read walk-ins" ON public.walk_ins FOR SELECT TO authenticated
  USING (public.is_salon_staff(auth.uid(), salon_id));
CREATE POLICY "Salon staff insert walk-ins" ON public.walk_ins FOR INSERT TO authenticated
  WITH CHECK (public.is_salon_staff(auth.uid(), salon_id));
CREATE POLICY "Salon staff update walk-ins" ON public.walk_ins FOR UPDATE TO authenticated
  USING (public.is_salon_staff(auth.uid(), salon_id))
  WITH CHECK (public.is_salon_staff(auth.uid(), salon_id));

CREATE SEQUENCE public.bill_number_seq;

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  bill_number text NOT NULL UNIQUE,
  source text NOT NULL CHECK (source IN ('online','walk_in')),
  booking_id uuid UNIQUE REFERENCES public.bookings(id),
  walk_in_id uuid UNIQUE REFERENCES public.walk_ins(id),
  customer_user_id uuid,
  customer_name text,
  customer_phone text,
  barber_id uuid,
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  discount numeric NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric NOT NULL CHECK (total >= 0),
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_salon_created ON public.bills (salon_id, created_at);

GRANT SELECT ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Salon staff read bills" ON public.bills FOR SELECT TO authenticated
  USING (public.is_salon_staff(auth.uid(), salon_id) OR customer_user_id = auth.uid());

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_items_bill ON public.bill_items (bill_id);

GRANT SELECT ON public.bill_items TO authenticated;
GRANT ALL ON public.bill_items TO service_role;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read bill items via bill" ON public.bill_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id
                 AND (public.is_salon_staff(auth.uid(), b.salon_id) OR b.customer_user_id = auth.uid())));

CREATE TRIGGER trg_walk_ins_updated_at BEFORE UPDATE ON public.walk_ins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bills_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- create a walk-in (staff only, service must belong to the salon)
CREATE OR REPLACE FUNCTION public.create_walk_in(
  p_salon_id uuid, p_service_id uuid, p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL, p_chair_id uuid DEFAULT NULL, p_barber_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_phone text;
BEGIN
  IF NOT public.is_salon_staff(auth.uid(), p_salon_id) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = p_service_id
                 AND (s.barber_id = p_salon_id OR s.barber_id IS NULL)) THEN
    RAISE EXCEPTION 'INVALID_SERVICE';
  END IF;
  v_phone := public.normalize_in_phone(p_customer_phone);
  INSERT INTO public.walk_ins (salon_id, chair_id, barber_id, customer_name, customer_phone, service_id)
  VALUES (p_salon_id, p_chair_id, COALESCE(p_barber_id, auth.uid()),
          NULLIF(trim(coalesce(p_customer_name,'')), ''), v_phone, p_service_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_walk_in_status(p_walk_in_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_salon uuid;
BEGIN
  IF p_status NOT IN ('waiting','in_service','completed','cancelled') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT salon_id INTO v_salon FROM public.walk_ins WHERE id = p_walk_in_id;
  IF v_salon IS NULL THEN RETURN false; END IF;
  IF NOT public.is_salon_staff(auth.uid(), v_salon) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  UPDATE public.walk_ins SET status = p_status, updated_at = now() WHERE id = p_walk_in_id;
  RETURN true;
END; $$;

-- generate a bill from a walk-in or an online booking; prices come from the DB only
CREATE OR REPLACE FUNCTION public.generate_bill(
  p_walk_in_id uuid DEFAULT NULL, p_booking_id uuid DEFAULT NULL,
  p_service_ids uuid[] DEFAULT NULL, p_discount numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_salon uuid; v_source text; v_bill uuid; v_sub numeric := 0; v_disc numeric;
  v_name text; v_phone text; v_barber uuid; v_user uuid; v_ids uuid[]; v_existing uuid;
BEGIN
  IF (p_walk_in_id IS NULL) = (p_booking_id IS NULL) THEN RAISE EXCEPTION 'INVALID_TARGET'; END IF;

  IF p_walk_in_id IS NOT NULL THEN
    SELECT w.salon_id, w.customer_name, w.customer_phone, w.barber_id, ARRAY[w.service_id]
      INTO v_salon, v_name, v_phone, v_barber, v_ids
      FROM public.walk_ins w WHERE w.id = p_walk_in_id;
    v_source := 'walk_in';
  ELSE
    SELECT b.barber_id, p.full_name, p.phone, b.user_id, ARRAY[b.service_id]
      INTO v_salon, v_name, v_phone, v_user, v_ids
      FROM public.bookings b LEFT JOIN public.profiles p ON p.id = b.user_id
      WHERE b.id = p_booking_id;
    v_source := 'online';
  END IF;

  IF v_salon IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.is_salon_staff(auth.uid(), v_salon) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  SELECT id INTO v_existing FROM public.bills
   WHERE (p_walk_in_id IS NOT NULL AND walk_in_id = p_walk_in_id)
      OR (p_booking_id IS NOT NULL AND booking_id = p_booking_id);
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN v_ids := p_service_ids; END IF;

  IF EXISTS (SELECT 1 FROM unnest(v_ids) sid
             WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = sid
                               AND (s.barber_id = v_salon OR s.barber_id IS NULL))) THEN
    RAISE EXCEPTION 'INVALID_SERVICE';
  END IF;

  SELECT COALESCE(sum(s.price), 0) INTO v_sub
    FROM unnest(v_ids) sid JOIN public.services s ON s.id = sid;

  v_disc := LEAST(GREATEST(COALESCE(p_discount, 0), 0), v_sub);

  INSERT INTO public.bills (salon_id, bill_number, source, booking_id, walk_in_id, customer_user_id,
                            customer_name, customer_phone, barber_id, subtotal, discount, total)
  VALUES (v_salon, 'MC-' || lpad(nextval('public.bill_number_seq')::text, 5, '0'), v_source,
          p_booking_id, p_walk_in_id, v_user, v_name, v_phone, COALESCE(v_barber, auth.uid()),
          v_sub, v_disc, v_sub - v_disc)
  RETURNING id INTO v_bill;

  INSERT INTO public.bill_items (bill_id, service_id, name, price)
  SELECT v_bill, s.id, s.name, s.price FROM unnest(v_ids) sid JOIN public.services s ON s.id = sid;

  IF p_walk_in_id IS NOT NULL THEN
    UPDATE public.walk_ins SET status = 'completed', updated_at = now()
     WHERE id = p_walk_in_id AND status <> 'cancelled';
  END IF;

  RETURN v_bill;
END; $$;

CREATE OR REPLACE FUNCTION public.record_payment(p_bill_id uuid, p_method text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_salon uuid; v_status text; v_rows int;
BEGIN
  IF p_method NOT IN ('cash','upi','card') THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
  SELECT salon_id, payment_status INTO v_salon, v_status FROM public.bills WHERE id = p_bill_id FOR UPDATE;
  IF v_salon IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.is_salon_staff(auth.uid(), v_salon) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  IF v_status = 'paid' THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  UPDATE public.bills SET payment_method = p_method, payment_status = 'paid', paid_at = now(), updated_at = now()
   WHERE id = p_bill_id AND payment_status = 'unpaid';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END; $$;

-- customer visit history by phone (staff only)
CREATE OR REPLACE FUNCTION public.lookup_customer_history(p_salon_id uuid, p_phone text)
RETURNS TABLE(visits integer, last_visit timestamptz, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text;
BEGIN
  IF NOT public.is_salon_staff(auth.uid(), p_salon_id) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;
  v_phone := public.normalize_in_phone(p_phone);
  IF v_phone IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT count(*)::int, max(b.created_at),
         COALESCE(max(b.customer_name), (SELECT p.full_name FROM public.profiles p WHERE p.phone = v_phone LIMIT 1))
  FROM public.bills b WHERE b.customer_phone = v_phone
  HAVING count(*) > 0;
END; $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_ins;
