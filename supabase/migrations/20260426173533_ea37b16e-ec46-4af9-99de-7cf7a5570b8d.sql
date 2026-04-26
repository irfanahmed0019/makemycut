-- Extend barbers table with directory + SEO fields
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_type text,
  ADD COLUMN IF NOT EXISTS status_tag text;

-- Constrain enum-like columns
ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_badge_type_check,
  ADD CONSTRAINT barbers_badge_type_check
    CHECK (badge_type IS NULL OR badge_type IN ('verified','new','featured','popular'));

ALTER TABLE public.barbers
  DROP CONSTRAINT IF EXISTS barbers_status_tag_check,
  ADD CONSTRAINT barbers_status_tag_check
    CHECK (status_tag IS NULL OR status_tag IN ('open-now','closed-temporarily','coming-soon'));

-- Trigram indexes for fast area/district ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS barbers_area_trgm
  ON public.barbers USING gin (area gin_trgm_ops);
CREATE INDEX IF NOT EXISTS barbers_district_trgm
  ON public.barbers USING gin (district gin_trgm_ops);
CREATE INDEX IF NOT EXISTS barbers_district_area_idx
  ON public.barbers (district, area) WHERE is_deleted = false;

-- Server-side slug normalizer used by trigger
CREATE OR REPLACE FUNCTION public.normalize_slug(val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(
    regexp_replace(lower(trim(coalesce(val, ''))), '\s+', '-', 'g'),
    '[^a-z0-9-]', '', 'g'
  );
$$;

-- Trigger: ensure district/area always stored as slugs
CREATE OR REPLACE FUNCTION public.barbers_normalize_slugs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.district IS NOT NULL THEN
    NEW.district := public.normalize_slug(NEW.district);
    IF NEW.district = '' THEN NEW.district := NULL; END IF;
  END IF;
  IF NEW.area IS NOT NULL THEN
    NEW.area := public.normalize_slug(NEW.area);
    IF NEW.area = '' THEN NEW.area := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS barbers_normalize_slugs_trg ON public.barbers;
CREATE TRIGGER barbers_normalize_slugs_trg
  BEFORE INSERT OR UPDATE OF district, area ON public.barbers
  FOR EACH ROW EXECUTE FUNCTION public.barbers_normalize_slugs();

-- Backfill existing rows with sensible defaults so they appear in the new directory
UPDATE public.barbers
SET district = COALESCE(district, 'trivandrum'),
    area = COALESCE(area, 'attingal')
WHERE district IS NULL OR area IS NULL;

-- Search RPC for /api/search-style lookups (used by the React search bar)
CREATE OR REPLACE FUNCTION public.search_areas(p_query text)
RETURNS TABLE(district text, area text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT b.district, b.area
  FROM public.barbers b
  WHERE b.is_deleted = false
    AND b.district IS NOT NULL
    AND b.area IS NOT NULL
    AND (
      p_query IS NULL OR p_query = ''
      OR b.district ILIKE '%' || p_query || '%'
      OR b.area ILIKE '%' || p_query || '%'
    )
  ORDER BY b.area
  LIMIT 10;
$$;

-- All distinct (district, area) pairs for the in-app area index
CREATE OR REPLACE FUNCTION public.list_area_index()
RETURNS TABLE(district text, area text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT b.district, b.area
  FROM public.barbers b
  WHERE b.is_deleted = false
    AND b.district IS NOT NULL
    AND b.area IS NOT NULL;
$$;