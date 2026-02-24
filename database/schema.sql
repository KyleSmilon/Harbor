-- Clean slate
drop table if exists messages cascade;
drop table if exists conversations cascade;
drop table if exists care_profiles cascade;
drop table if exists profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists update_updated_at cascade;

-- Profiles
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  full_name text,
  emergency_contact_name text,
  emergency_contact_phone text
);

comment on column profiles.emergency_contact_phone is 'Sensitive: PII. Only expose to owning user.';

-- Care profiles
create table care_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  care_recipient_name text,
  relationship text,
  duration_months integer,
  biggest_challenge text,
  support_situation text,
  current_feeling integer check (current_feeling between 1 and 5)
);

comment on column care_profiles.biggest_challenge is 'Sensitive: user-reported caregiving challenges. PII-adjacent.';

-- Conversations
create table conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint conversations_id_user_id_unique unique (id, user_id)
);

-- Messages
create table messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  flagged boolean default false not null,
  constraint message_owner_matches_conversation
    foreign key (conversation_id, user_id)
    references conversations(id, user_id)
);

comment on column messages.content is 'Sensitive: contains raw user/AI conversation. Never log, never expose via API without auth.';

-- RLS
alter table profiles enable row level security;
alter table care_profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Profile policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can delete own profile" on profiles for delete using (auth.uid() = id);

-- Care profile policies
create policy "Users can manage own care profiles" on care_profiles for all using (auth.uid() = user_id);
create policy "Users can delete own care profiles" on care_profiles for delete using (auth.uid() = user_id);

-- Conversation policies
create policy "Users can manage own conversations" on conversations for all using (auth.uid() = user_id);
create policy "Users can delete own conversations" on conversations for delete using (auth.uid() = user_id);

-- Message policies
create policy "Users can manage own messages" on messages for all using (auth.uid() = user_id);
create policy "Users can delete own messages" on messages for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

create trigger care_profiles_updated_at
  before update on care_profiles
  for each row execute procedure update_updated_at();