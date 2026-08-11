CREATE OR REPLACE FUNCTION public.set_my_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_norm text; v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF;

  v_norm := public.normalize_in_phone(p_phone);
  IF v_norm IS NULL THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF public.is_spam_phone(v_norm) THEN RAISE EXCEPTION 'SPAM_PHONE'; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = v_norm AND id <> v_uid) THEN
    RAISE EXCEPTION 'PHONE_TAKEN';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    v_uid,
    COALESCE((SELECT u.raw_user_meta_data->>'full_name' FROM auth.users u WHERE u.id = v_uid), 'Customer'),
    v_norm
  )
  ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now();

  RETURN v_norm;
END;
$$;