CREATE OR REPLACE FUNCTION public.consume_daily_chat(_user_id uuid, _limit integer DEFAULT 5)
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

  reset_at := p.daily_chat_reset_at;
  IF now() - reset_at > interval '24 hours' THEN
    p.daily_chat_count := 0;
    reset_at := now();
  END IF;

  IF p.tier <> 'free' THEN
    UPDATE public.profiles
      SET daily_chat_count = p.daily_chat_count, daily_chat_reset_at = reset_at
      WHERE id = _user_id;
    RETURN QUERY SELECT true, p.tier, _limit;
    RETURN;
  END IF;

  IF p.daily_chat_count >= _limit THEN
    UPDATE public.profiles SET daily_chat_reset_at = reset_at WHERE id = _user_id;
    RETURN QUERY SELECT false, p.tier, 0;
    RETURN;
  END IF;

  new_count := p.daily_chat_count + 1;
  UPDATE public.profiles
    SET daily_chat_count = new_count, daily_chat_reset_at = reset_at
    WHERE id = _user_id;

  RETURN QUERY SELECT true, p.tier, GREATEST(_limit - new_count, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.consume_daily_chat(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_daily_chat(uuid, integer) TO service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_status    text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.profiles
  FROM anon, authenticated;