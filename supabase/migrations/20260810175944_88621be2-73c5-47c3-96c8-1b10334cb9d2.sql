CREATE OR REPLACE FUNCTION public.owner_search_users(p_salon_id uuid, p_query text)
RETURNS TABLE(user_id uuid, email text, full_name text, phone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = p_salon_id AND b.owner_id = auth.uid())
  ) THEN
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

REVOKE ALL ON FUNCTION public.owner_search_users(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.owner_search_users(uuid, text) TO authenticated;