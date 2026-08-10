CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(user_id uuid, email text, full_name text, phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE coalesce(p_query, '') <> ''
    AND (
      u.email ILIKE '%' || p_query || '%'
      OR coalesce(p.full_name, '') ILIKE '%' || p_query || '%'
      OR coalesce(p.phone, '') ILIKE '%' || p_query || '%'
      OR u.id::text = p_query
    )
  ORDER BY u.email
  LIMIT 10;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_search_users(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_lookup_user(p_user_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text, phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name, p.phone
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_lookup_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_lookup_user(uuid) TO authenticated;
