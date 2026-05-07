-- ============================================================
-- 1. Lock down external_listings: remove fake public SELECT
-- ============================================================
DROP POLICY IF EXISTS "public view by share token" ON public.external_listings;

-- Owner SELECT policy already exists ("users view own imports"); keep it.

-- ============================================================
-- 2. Public shared-listing RPC: enforces expiry + masking server-side
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shared_listing(_token uuid)
RETURNS TABLE (
  id uuid,
  source text,
  title text,
  price_monthly integer,
  bedrooms numeric,
  bathrooms numeric,
  location text,
  notes text,
  url text,
  share_expires_at timestamptz,
  share_mask_sensitive boolean,
  created_at timestamptz,
  expired boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.external_listings%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.external_listings WHERE share_token = _token;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF r.share_expires_at IS NOT NULL AND r.share_expires_at < now() THEN
    -- Return a single row marked expired with no payload
    RETURN QUERY SELECT
      NULL::uuid, NULL::text, NULL::text, NULL::integer, NULL::numeric, NULL::numeric,
      NULL::text, NULL::text, NULL::text,
      r.share_expires_at, r.share_mask_sensitive, NULL::timestamptz, true;
    RETURN;
  END IF;

  IF r.share_mask_sensitive THEN
    RETURN QUERY SELECT
      r.id, r.source, r.title, r.price_monthly, r.bedrooms, r.bathrooms,
      -- city-only: keep last comma segment
      NULLIF(trim(split_part(COALESCE(r.location, ''), ',',
        GREATEST(1, array_length(string_to_array(r.location, ','), 1)))), '') AS location,
      NULL::text AS notes,
      NULL::text AS url,
      r.share_expires_at, r.share_mask_sensitive, r.created_at, false;
  ELSE
    RETURN QUERY SELECT
      r.id, r.source, r.title, r.price_monthly, r.bedrooms, r.bathrooms,
      r.location, r.notes, r.url,
      r.share_expires_at, r.share_mask_sensitive, r.created_at, false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_listing(uuid) TO anon, authenticated;

-- ============================================================
-- 3. Length & content limits via validation triggers
--    (avoid CHECK constraints so we can use regex/dynamic checks safely)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_external_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.url IS NULL OR length(NEW.url) > 2048 OR length(NEW.url) < 1 THEN
    RAISE EXCEPTION 'url must be 1-2048 chars';
  END IF;
  IF NEW.url !~* '^https?://' THEN
    RAISE EXCEPTION 'url must start with http:// or https://';
  END IF;
  IF NEW.title IS NOT NULL AND length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'title too long (max 200)';
  END IF;
  IF NEW.location IS NOT NULL AND length(NEW.location) > 200 THEN
    RAISE EXCEPTION 'location too long (max 200)';
  END IF;
  IF NEW.notes IS NOT NULL AND length(NEW.notes) > 2000 THEN
    RAISE EXCEPTION 'notes too long (max 2000)';
  END IF;
  IF NEW.source IS NOT NULL AND length(NEW.source) > 32 THEN
    RAISE EXCEPTION 'source too long';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO cnt FROM public.external_listings WHERE user_id = NEW.user_id;
    IF cnt >= 500 THEN
      RAISE EXCEPTION 'import limit reached (500 per user)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS external_listings_validate ON public.external_listings;
CREATE TRIGGER external_listings_validate
  BEFORE INSERT OR UPDATE ON public.external_listings
  FOR EACH ROW EXECUTE FUNCTION public.validate_external_listing();

-- ============================================================
-- 4. Reminders: limits + index
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_reminder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.title IS NULL OR length(NEW.title) < 1 OR length(NEW.title) > 200 THEN
    RAISE EXCEPTION 'title must be 1-200 chars';
  END IF;
  IF NEW.notes IS NOT NULL AND length(NEW.notes) > 2000 THEN
    RAISE EXCEPTION 'notes too long (max 2000)';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO cnt FROM public.reminders WHERE user_id = NEW.user_id;
    IF cnt >= 500 THEN
      RAISE EXCEPTION 'reminder limit reached (500 per user)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reminders_validate ON public.reminders;
CREATE TRIGGER reminders_validate
  BEFORE INSERT OR UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.validate_reminder();

CREATE INDEX IF NOT EXISTS reminders_user_due_idx
  ON public.reminders(user_id, due_at);
