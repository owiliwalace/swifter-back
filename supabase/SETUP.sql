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


-- SwiftTrade application schema, based on visible product features.
-- This is not an export of the reference site's private database.
create table if not exists public.currencies (
 code text primary key, name text not null, decimals integer not null check(decimals between 0 and 18), kind text not null check(kind in ('fiat','crypto'))
);
insert into public.currencies values
('KES','Kenyan Shilling',2,'fiat'),('USD','US Dollar',2,'fiat'),('EUR','Euro',2,'fiat'),('GBP','British Pound',2,'fiat'),
('NGN','Nigerian Naira',2,'fiat'),('UGX','Ugandan Shilling',0,'fiat'),('TZS','Tanzanian Shilling',2,'fiat'),('ZAR','South African Rand',2,'fiat'),
('BTC','Bitcoin',8,'crypto'),('ETH','Ethereum',18,'crypto'),('USDT','Tether',6,'crypto') on conflict(code) do nothing;
create table if not exists public.payment_providers (
 id text primary key,name text not null,enabled boolean not null default false,supported_currencies text[] not null default '{}',created_at timestamptz not null default now()
);
insert into public.payment_providers(id,name,supported_currencies)values
('mpesa','M-Pesa',array['KES']),('card','Visa / Mastercard',array['KES','USD','EUR','GBP']),
('crypto','Cryptocurrency',array['BTC','ETH','USDT']),('bank','Bank transfer',array['KES','USD','EUR','GBP']),
('mobile_money','Other mobile money',array['UGX','TZS','NGN'])on conflict(id)do nothing;
create table if not exists public.markets (
 id text primary key,name text not null,provider_symbol text,is_active boolean not null default false,created_at timestamptz not null default now()
);
insert into public.markets(id,name)values ('vol10','Volatility 10 (1s) Index'),('vol25','Volatility 25 (1s) Index'),('vol50','Volatility 50 (1s) Index'),('vol75','Volatility 75 (1s) Index'),('vol100','Volatility 100 (1s) Index')on conflict(id)do nothing;
create table if not exists public.contract_types (
 id text primary key,name text not null,enabled boolean not null default false
);
insert into public.contract_types values('rise_fall','Rise / Fall',false),('even_odd','Even / Odd',false),('match_differ','Matches / Differs',false),('over_under','Over / Under',false)on conflict(id)do nothing;
create table if not exists public.trades (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 market text not null,contract text not null,side text not null,stake numeric(18,8)not null check(stake>0),
 payout numeric(18,8)not null default 0 check(payout>=0),duration integer not null default 1 check(duration>0),
 barrier numeric,status text not null default 'open' check(status in('open','won','lost','cancelled')),
 created_at timestamptz not null default now()
);
alter table public.trades add column if not exists account_mode text not null default 'demo' check(account_mode in('demo','real'));
alter table public.trades add column if not exists currency text not null default 'USD';
alter table public.trades add column if not exists provider_trade_id text;
alter table public.trades add column if not exists settled_at timestamptz;
create table if not exists public.transactions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 type text not null,amount numeric(28,18)not null check(amount>=0),currency text not null default 'KES',note text,created_at timestamptz not null default now()
);
alter table public.transactions add column if not exists currency text not null default 'KES';
create table if not exists public.currency_wallets (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 currency text not null references public.currencies(code) check(currency<>'KES'),balance numeric(36,18)not null default 0 check(balance>=0),
 created_at timestamptz not null default now(),unique(user_id,currency)
);
-- KES source of truth remains profiles.wallet_kes and wallet_entries.
create table if not exists public.withdrawals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 provider_id text not null references public.payment_providers(id),currency text not null references public.currencies(code),
 amount numeric(36,18)not null check(amount>0),destination jsonb not null default '{}',
 status text not null default 'requested' check(status in('requested','review','approved','processing','completed','rejected','cancelled')),
 provider_reference text unique,created_at timestamptz not null default now(),processed_at timestamptz
);
create table if not exists public.user_settings (
 user_id uuid primary key references public.profiles(id)on delete cascade,
 preferred_currency text not null default 'USD' references public.currencies(code),theme text not null default 'light',
 selected_market text,selected_contract text,notifications_enabled boolean not null default true,updated_at timestamptz not null default now()
);
create table if not exists public.bot_strategies (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 name text not null,configuration jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.bot_runs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 strategy_id uuid references public.bot_strategies(id)on delete set null,account_mode text not null default 'demo' check(account_mode in('demo','real')),
 status text not null default 'stopped',summary jsonb not null default '{}',created_at timestamptz not null default now(),ended_at timestamptz
);
create table if not exists public.scanner_runs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 category text not null,status text not null default 'pending',results jsonb not null default '{}',created_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.support_conversations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 subject text not null default 'Support request',status text not null default 'open' check(status in('open','closed')),created_at timestamptz not null default now()
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 conversation_id uuid references public.support_conversations(id)on delete cascade,
 sender_role text not null default 'user' check(sender_role in('user','support')),
 message text not null check(char_length(message)between 1 and 2000),created_at timestamptz not null default now()
);
create table if not exists public.referrals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 referred_user_id uuid unique references public.profiles(id)on delete set null,code text not null,created_at timestamptz not null default now()
);
create table if not exists public.documents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id)on delete cascade,
 bucket text not null,object_path text not null,mime_type text,size_bytes bigint check(size_bytes>=0),
 status text not null default 'uploaded',created_at timestamptz not null default now(),unique(bucket,object_path)
);
create table if not exists public.site_files (
 id uuid primary key default gen_random_uuid(),bucket text not null default 'site-assets',object_path text not null unique,
 mime_type text,size_bytes bigint,created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,user_id uuid references public.profiles(id)on delete set null,
 action text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now()
);
create table if not exists public.webhook_events (
 id uuid primary key default gen_random_uuid(),provider_id text not null,event_id text not null,status text not null default 'received',
 payload_hash text,created_at timestamptz not null default now(),processed_at timestamptz,unique(provider_id,event_id)
);
do $$
declare tab text;
begin
 foreach tab in array array['trades','transactions','currency_wallets','withdrawals','user_settings','bot_strategies','bot_runs','scanner_runs','notifications','support_conversations','support_messages','referrals','documents']loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('drop policy if exists owner_read on public.%I',tab);
  execute format('create policy owner_read on public.%I for select to authenticated using((select auth.uid())=user_id)',tab);
  execute format('revoke all on public.%I from anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
  execute format('grant all on public.%I to service_role',tab);
  execute format('create index if not exists %I on public.%I(user_id)',tab||'_owner_idx',tab);
 end loop;
 foreach tab in array array['currencies','payment_providers','markets','contract_types','site_files']loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from anon,authenticated',tab);
  execute format('grant all on public.%I to service_role',tab);
 end loop;
 foreach tab in array array['audit_logs','webhook_events']loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from anon,authenticated',tab);
  execute format('grant all on public.%I to service_role',tab);
 end loop;
end $$;
