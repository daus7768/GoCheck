-- user_profiles: stores per-user preferences synced across devices
-- Security settings (PIN, biometric) are stored on-device only and never here.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'MYR',
  dark_mode boolean not null default false,
  offline_mode boolean not null default false,
  payment_methods text[] not null default '{}',
  notif_push boolean not null default true,
  notif_email boolean not null default true,
  notif_whatsapp boolean not null default false,
  notif_due_soon boolean not null default true,
  notif_overdue boolean not null default true,
  notif_weekly_digest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'users can manage own profile'
  ) then
    execute $policy$
      create policy "users can manage own profile"
        on public.user_profiles
        for all
        using (auth.uid() = id)
        with check (auth.uid() = id)
    $policy$;
  end if;
end;
$$;

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.handle_updated_at();
