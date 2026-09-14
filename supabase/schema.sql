-- Run in the Supabase SQL Editor. Safe to re-run.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  balance numeric(14,2) not null default 10000 check (balance >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);
-- balance is the existing demo balance; real M-Pesa funds are always KES.
alter table public.profiles add column if not exists wallet_kes numeric(14,2) not null default 0 check (wallet_kes >= 0);
alter table public.profiles add column if not exists payment_reference text;
update public.profiles set payment_reference = 'N' || upper(substr(replace(id::text, '-', ''), 1, 11)) where payment_reference is null;
create unique index if not exists profiles_payment_reference_key on public.profiles(payment_reference);
alter table public.profiles enable row level security;
drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, payment_reference)
  values (new.id, left(new.raw_user_meta_data->>'full_name', 120), 'N' || upper(substr(replace(new.id::text, '-', ''), 1, 11)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,full_name,payment_reference)
select id,left(raw_user_meta_data->>'full_name',120),'N' || upper(substr(replace(id::text,'-',''),1,11)) from auth.users on conflict(id) do nothing;

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  amount numeric(14,2) not null check(amount > 0 and amount <= 150000),
  currency text not null default 'KES' check(currency = 'KES'),
  phone text,
  reference text,
  channel text not null check(channel in ('stk','ipn')),
  status text not null check(status in ('initiating','pending','review','completed')),
  checkout_id text unique,
  receipt text unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists deposits_user_created_idx on public.deposits(user_id,created_at desc);
alter table public.deposits enable row level security;
drop policy if exists "deposits are readable by owner" on public.deposits;
create policy "deposits are readable by owner" on public.deposits for select to authenticated using((select auth.uid()) = user_id);
revoke all on public.deposits from anon, authenticated;
grant select on public.deposits to authenticated;
grant all on public.deposits to service_role;

create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  deposit_id uuid not null unique references public.deposits(id),
  user_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check(amount > 0),
  currency text not null default 'KES' check(currency = 'KES'),
  created_at timestamptz not null default now()
);
alter table public.wallet_entries enable row level security;
drop policy if exists "wallet entries are readable by owner" on public.wallet_entries;
create policy "wallet entries are readable by owner" on public.wallet_entries for select to authenticated using((select auth.uid()) = user_id);
revoke all on public.wallet_entries from anon, authenticated;
grant select on public.wallet_entries to authenticated;
grant all on public.wallet_entries to service_role;

create or replace function public.credit_mpesa_deposit(p_id uuid, p_receipt text)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.deposits;
begin
  if p_receipt is null or p_receipt !~ '^[A-Z0-9]{8,20}$' then raise exception 'Invalid receipt'; end if;
  select * into d from public.deposits where id = p_id for update;
  if not found or d.user_id is null then raise exception 'Unmatched deposit'; end if;
  if d.receipt is not null and d.receipt <> p_receipt then raise exception 'Receipt mismatch'; end if;
  if d.status = 'completed' then return; end if;
  update public.deposits set receipt = p_receipt, status = 'completed', completed_at = now() where id = p_id;
  insert into public.wallet_entries(deposit_id,user_id,amount) values(d.id,d.user_id,d.amount);
  update public.profiles set wallet_kes = wallet_kes + d.amount where id = d.user_id;
end;
$$;
revoke all on function public.credit_mpesa_deposit(uuid,text) from public, anon, authenticated;
grant execute on function public.credit_mpesa_deposit(uuid,text) to service_role;
-- Disable the legacy demo trade RPC until a settlement engine is implemented.
do $$ begin
  if to_regprocedure('public.place_trade(uuid,jsonb)') is not null then
    execute 'revoke execute on function public.place_trade(uuid,jsonb) from public, anon, authenticated';
  end if;
end $$;
