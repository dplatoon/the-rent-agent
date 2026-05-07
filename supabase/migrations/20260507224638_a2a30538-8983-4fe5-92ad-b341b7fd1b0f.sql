
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_draft_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_draft_reset_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.consume_daily_draft(_user_id uuid, _limit integer DEFAULT 10)
RETURNS TABLE(allowed boolean, tier text, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.profiles%ROWTYPE;
  new_count integer;
  reset_at timestamptz;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, 0;
    RETURN;
  END IF;

  reset_at := p.daily_draft_reset_at;
  IF now() - reset_at > interval '24 hours' THEN
    p.daily_draft_count := 0;
    reset_at := now();
  END IF;

  IF p.tier = 'free' AND p.daily_draft_count >= _limit THEN
    UPDATE public.profiles SET daily_draft_reset_at = reset_at WHERE id = _user_id;
    RETURN QUERY SELECT false, p.tier, 0;
    RETURN;
  END IF;

  new_count := p.daily_draft_count + CASE WHEN p.tier = 'free' THEN 1 ELSE 0 END;
  UPDATE public.profiles
    SET daily_draft_count = new_count, daily_draft_reset_at = reset_at
    WHERE id = _user_id;

  RETURN QUERY SELECT true, p.tier, GREATEST(_limit - new_count, 0);
END;
$function$;
