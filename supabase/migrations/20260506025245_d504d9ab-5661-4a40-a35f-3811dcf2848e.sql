
-- profiles
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  tier text not null default 'free' check (tier in ('free','pro','premium')),
  daily_chat_count int not null default 0,
  daily_chat_reset_at timestamptz not null default now(),
  preferred_state text,
  budget_min int,
  budget_max int,
  bedrooms int,
  pet_friendly bool default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- agents (public read)
create table public.agents (
  id text primary key,
  state text not null,
  name text not null,
  avatar_emoji text not null,
  color text not null,
  specialty text not null,
  bio text not null,
  personality_traits text[] not null default '{}',
  greeting text not null,
  rating numeric(2,1) not null default 4.8,
  total_chats int not null default 0,
  is_online bool not null default true,
  map_x numeric not null,
  map_y numeric not null,
  created_at timestamptz not null default now()
);
alter table public.agents enable row level security;
create policy "agents public read" on public.agents for select using (true);

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  agent_id text not null references public.agents(id),
  title text,
  last_message_at timestamptz not null default now(),
  message_count int not null default 0,
  created_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations(user_id, last_message_at desc);
alter table public.conversations enable row level security;
create policy "users view own convos" on public.conversations for select using (auth.uid() = user_id);
create policy "users insert own convos" on public.conversations for insert with check (auth.uid() = user_id);
create policy "users update own convos" on public.conversations for update using (auth.uid() = user_id);
create policy "users delete own convos" on public.conversations for delete using (auth.uid() = user_id);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','agent')),
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy "users view own messages" on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create policy "users insert own messages" on public.messages for insert with check (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
