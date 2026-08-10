-- Salon owners / admins manage salon images; everyone can read them.
CREATE POLICY "salon images readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'salon-images');

CREATE POLICY "salon images insert by owner or admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'salon-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
);

CREATE POLICY "salon images update by owner or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'salon-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
);

CREATE POLICY "salon images delete by owner or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'salon-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.barbers b
      WHERE b.owner_id = auth.uid()
        AND (storage.foldername(name))[1] = b.id::text
    )
  )
);