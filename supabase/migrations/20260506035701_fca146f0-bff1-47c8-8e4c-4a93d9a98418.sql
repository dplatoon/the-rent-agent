-- Listings table
CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  price_monthly INTEGER NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms NUMERIC NOT NULL,
  sqft INTEGER,
  pet_friendly BOOLEAN NOT NULL DEFAULT false,
  furnished BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT NOT NULL,
  description TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  available_from DATE,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings public read" ON public.listings FOR SELECT USING (true);

CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_listings_agent_id ON public.listings(agent_id);
CREATE INDEX idx_listings_state ON public.listings(state);
CREATE INDEX idx_listings_price ON public.listings(price_monthly);

-- Saved listings table
CREATE TABLE public.saved_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own saved" ON public.saved_listings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own saved" ON public.saved_listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own saved" ON public.saved_listings FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_saved_listings_user ON public.saved_listings(user_id);