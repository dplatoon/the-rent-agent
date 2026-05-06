drop policy "Anyone can insert pwa events" on public.pwa_events;

create policy "Anyone can insert known pwa events"
  on public.pwa_events for insert
  to anon, authenticated
  with check (
    event in (
      'prompt_shown',
      'prompt_accepted',
      'prompt_dismissed',
      'installed',
      'pill_dismissed',
      'ios_open_in_safari',
      'ios_copy_link',
      'ios_help_opened',
      'unsupported_help_opened'
    )
    and (length(coalesce(user_agent, '')) <= 500)
    and (length(coalesce(platform, '')) <= 50)
  );
