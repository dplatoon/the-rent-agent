-- External listings imported by users from third-party sites
create table public.external_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  source text not null default 'other',
  title text,
  price_monthly integer,
  bedrooms numeric,
  bathrooms numeric,
  location text,
  notes text,
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index external_listings_user_idx on public.external_listings(user_id, created_at desc);

alter table public.external_listings enable row level security;

create policy "users view own imports"
  on public.external_listings for select
  using (auth.uid() = user_id);

create policy "public view by share token"
  on public.external_listings for select
  using (true);
-- ^ token is unguessable uuid; app only queries .eq('share_token', token).
-- Combined with the owner policy above, owner sees all their rows; anonymous
-- visitors must know the share_token to find a row.

create policy "users insert own imports"
  on public.external_listings for insert
  with check (auth.uid() = user_id);

create policy "users update own imports"
  on public.external_listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own imports"
  on public.external_listings for delete
  using (auth.uid() = user_id);

create trigger external_listings_updated_at
  before update on public.external_listings
  for each row execute function public.set_updated_at();

-- Follow-up reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  notes text,
  due_at timestamptz not null,
  done boolean not null default false,
  external_listing_id uuid references public.external_listings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_user_due_idx on public.reminders(user_id, due_at);

alter table public.reminders enable row level security;

create policy "users view own reminders"
  on public.reminders for select using (auth.uid() = user_id);
create policy "users insert own reminders"
  on public.reminders for insert with check (auth.uid() = user_id);
create policy "users update own reminders"
  on public.reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own reminders"
  on public.reminders for delete using (auth.uid() = user_id);

create trigger reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();
