ALTER TABLE public.external_listings
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS share_mask_sensitive boolean NOT NULL DEFAULT false;