CREATE TABLE public.rentcast_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rentcast_id TEXT NOT NULL UNIQUE,
  agent_id TEXT REFERENCES public.agents(id) ON DELETE SET NULL,
  address TEXT,
  city TEXT,
  state TEXT NOT NULL,
  zip TEXT,
  lat NUMERIC,
  lng NUMERIC,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  sqft INTEGER,
  price INTEGER,
  property_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  raw JSONB,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rentcast_listings_state ON public.rentcast_listings(state);
CREATE INDEX idx_rentcast_listings_agent ON public.rentcast_listings(agent_id);
CREATE INDEX idx_rentcast_listings_status ON public.rentcast_listings(status);
CREATE INDEX idx_rentcast_listings_last_seen ON public.rentcast_listings(last_seen_at);

ALTER TABLE public.rentcast_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rentcast_listings public read"
  ON public.rentcast_listings FOR SELECT
  USING (true);

CREATE TRIGGER set_rentcast_listings_updated_at
  BEFORE UPDATE ON public.rentcast_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();