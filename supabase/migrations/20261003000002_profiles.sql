-- Admin authorization model.
--
-- mktbd has exactly one privileged role in V1 ("admin"). Every Supabase Auth
-- user gets a public.profiles row (role defaults to 'user') via a trigger on
-- auth.users. Promoting a user to admin is a deliberate manual step (see
-- docs/SUPABASE_SETUP.md) -- there is no self-serve way to become an admin.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase Auth user. role=''admin'' is the only privileged
   value in V1 and must be granted manually -- see docs/SUPABASE_SETUP.md.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- SECURITY DEFINER so it can read public.profiles regardless of the calling
-- role's RLS visibility (a plain 'authenticated' role can only see its own
-- profile row -- see policy below -- which would make a non-definer version
-- of this function unusable from most RLS policies).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True if the current auth.uid() has role=''admin'' in public.profiles.
   Used throughout RLS policies to distinguish admin from merely-authenticated.';

-- Auto-create a profile row (role='user') whenever a new Auth user signs up,
-- so admin promotion only ever has to update an existing row, never insert
-- one. SECURITY DEFINER lets this trigger write to public.profiles even
-- though no RLS policy below grants INSERT to ordinary roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- A user may always read their own profile (so the app can know its own
-- role); an admin may read everyone's. No other visibility. There is no
-- INSERT/UPDATE/DELETE policy at all -- role changes happen only via the
-- service-role client or the Supabase SQL editor, never through the app's
-- normal anon/authenticated session. This is intentional: it keeps "become
-- an admin" from ever being reachable through an application bug.
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());
