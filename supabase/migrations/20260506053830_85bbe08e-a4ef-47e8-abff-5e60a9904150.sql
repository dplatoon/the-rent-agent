create table public.pwa_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  platform text,
  user_agent text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index pwa_events_event_created_at_idx on public.pwa_events (event, created_at desc);

alter table public.pwa_events enable row level security;

-- Anyone (anon or authenticated) can insert telemetry events
create policy "Anyone can insert pwa events"
  on public.pwa_events for insert
  to anon, authenticated
  with check (true);

-- No public read; analytics happens via service role
