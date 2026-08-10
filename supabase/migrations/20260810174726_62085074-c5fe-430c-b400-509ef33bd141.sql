-- Normalize an input phone to +91XXXXXXXXXX, or NULL when invalid
CREATE OR REPLACE FUNCTION public.normalize_in_phone(p_phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  IF length(d) > 10 THEN
    d := right(d, 10);
  END IF;
  IF d !~ '^[6-9][0-9]{9}$' THEN
    RETURN NULL;
  END IF;
  RETURN '+91' || d;
END;
$$;

-- Detect obviously fake / spam numbers
CREATE OR REPLACE FUNCTION public.is_spam_phone(p_phone text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text; i int; asc_run boolean := true; desc_run boolean := true; distinct_cnt int;
BEGIN
  d := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  IF length(d) > 10 THEN d := right(d, 10); END IF;
  IF length(d) <> 10 THEN RETURN true; END IF;

  SELECT count(DISTINCT ch) INTO distinct_cnt
  FROM regexp_split_to_table(d, '') AS ch;
  IF distinct_cnt <= 2 THEN RETURN true; END IF;

  FOR i IN 2..10 LOOP
    IF substr(d, i, 1)::int <> (substr(d, i-1, 1)::int + 1) % 10 THEN asc_run := false; END IF;
    IF substr(d, i, 1)::int <> (substr(d, i-1, 1)::int + 9) % 10 THEN desc_run := false; END IF;
  END LOOP;
  RETURN asc_run OR desc_run;
END;
$$;

-- Backfill existing rows into canonical format
UPDATE public.profiles
SET phone = COALESCE(public.normalize_in_phone(phone), '')
WHERE coalesce(phone,'') <> '';

-- One account per phone number
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone) WHERE coalesce(phone,'') <> '';

-- Claim / update the caller's phone number with validation
CREATE OR REPLACE FUNCTION public.set_my_phone(p_phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_norm text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  v_norm := public.normalize_in_phone(p_phone);
  IF v_norm IS NULL THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF public.is_spam_phone(v_norm) THEN RAISE EXCEPTION 'SPAM_PHONE'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_norm AND id <> auth.uid()) THEN
    RAISE EXCEPTION 'PHONE_TAKEN';
  END IF;

  UPDATE public.profiles SET phone = v_norm, updated_at = now() WHERE id = auth.uid();
  RETURN v_norm;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_spam_phone(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.normalize_in_phone(text) TO authenticated, anon;

-- Normalize phone captured at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text;
BEGIN
  v_phone := COALESCE(public.normalize_in_phone(NEW.raw_user_meta_data->>'phone'), '');
  IF v_phone <> '' AND (public.is_spam_phone(v_phone)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_phone)) THEN
    v_phone := '';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_phone,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- Admins need contact access too
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
