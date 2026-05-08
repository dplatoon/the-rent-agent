DROP POLICY "Anyone can insert known pwa events" ON public.pwa_events;

CREATE POLICY "Anyone can insert known pwa events"
  ON public.pwa_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event = ANY (ARRAY[
      'prompt_shown','prompt_accepted','prompt_dismissed',
      'installed','pill_dismissed','ios_open_in_safari',
      'ios_copy_link','ios_help_opened','unsupported_help_opened'
    ])
    AND length(COALESCE(user_agent, '')) <= 500
    AND length(COALESCE(platform, '')) <= 50
    AND (user_id IS NULL OR user_id = auth.uid())
  );