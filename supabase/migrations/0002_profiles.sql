create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('admin','supervisor','caregiver')),
  institution text,
  ward text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Security-definer helper so RLS policies can check "is this caller
-- an admin" without recursively re-triggering RLS on profiles itself.
create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Users can read their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on profiles for select
  using (public.is_admin());

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Only admins may create profile rows for other users. Public
-- self-signup is intentionally NOT permitted by this policy —
-- account creation happens through an admin-only path, enforced
-- separately at the application layer.
create policy "Admins can insert profiles"
  on profiles for insert
  with check (public.is_admin());
