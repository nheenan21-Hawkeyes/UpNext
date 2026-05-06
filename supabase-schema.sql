-- UpNext Supabase schema
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  school text,
  headline text default 'Student job seeker',
  created_at timestamptz default now()
);

create table if not exists public.applications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  location text,
  job_type text,
  source text,
  application_link text,
  deadline date,
  date_applied date,
  status text not null default 'Saved' check (status in ('Saved','Applied','Interviewing','Offer','Rejected')),
  contact_person text,
  follow_up_date date,
  notes text,
  visibility text not null default 'Private' check (visibility in ('Private','Public')),
  hide_company boolean default false,
  public_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.follows (
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.activity_feed (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  event_type text not null,
  message text not null,
  is_public boolean default true,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.follows enable row level security;
alter table public.activity_feed enable row level security;

-- Profiles: anyone can view public profile info, users edit their own
create policy "Profiles are viewable" on public.profiles for select using (true);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Applications: owner sees all; public only shows public rows
create policy "Users select own applications" on public.applications for select using (auth.uid() = user_id);
create policy "Public can view public applications" on public.applications for select using (visibility = 'Public');
create policy "Users insert own applications" on public.applications for insert with check (auth.uid() = user_id);
create policy "Users update own applications" on public.applications for update using (auth.uid() = user_id);
create policy "Users delete own applications" on public.applications for delete using (auth.uid() = user_id);

-- Follows
create policy "Users can view follows" on public.follows for select using (true);
create policy "Users can follow" on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow" on public.follows for delete using (auth.uid() = follower_id);

-- Activity feed: owner sees own; public feed visible if is_public
create policy "Users select own activity" on public.activity_feed for select using (auth.uid() = user_id);
create policy "Public select public activity" on public.activity_feed for select using (is_public = true);
create policy "Users insert own activity" on public.activity_feed for insert with check (auth.uid() = user_id);

-- Auto profile creation after signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name)
  values (new.id, split_part(new.email, '@', 1), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
