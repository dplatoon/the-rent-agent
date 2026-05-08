ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS catchphrase text,
  ADD COLUMN IF NOT EXISTS major_city text,
  ADD COLUMN IF NOT EXISTS avatar_image_url text;