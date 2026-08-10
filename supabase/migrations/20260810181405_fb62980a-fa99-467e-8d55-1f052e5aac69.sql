ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS text_value text;
ALTER TABLE public.app_settings ALTER COLUMN bool_value DROP NOT NULL;
INSERT INTO public.app_settings (key, bool_value, text_value)
VALUES ('contact_email', false, 'makemycut.official@gmail.com')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, p.full_name
  FROM public.user_roles r
  JOIN auth.users u ON u.id = r.user_id
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE r.role = 'admin'
  ORDER BY u.email;
END;
$$;