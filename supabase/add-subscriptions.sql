-- Billing: one subscription row per account, plan is seasonal (a single
-- payment grants access until access_until, no auto-renewal). See
-- supabase/functions/stripe-checkout and supabase/functions/stripe-webhook
-- for how Stripe flips status to 'active' after a successful payment.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text check (plan in ('single', 'triple', 'unlimited')),
  max_teams integer, -- null = unlimited
  status text not null default 'inactive' check (status in ('inactive', 'active', 'expired', 'free_override')),
  access_until timestamp with time zone,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

alter table subscriptions enable row level security;

drop policy if exists "select_own_subscription" on subscriptions;
create policy "select_own_subscription" on subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "admin_select_all_subscriptions" on subscriptions;
create policy "admin_select_all_subscriptions" on subscriptions
  for select using (public.is_admin());
-- No insert/update/delete policy for authenticated/anon on purpose — only
-- service_role (the Stripe webhook and the admin-set-plan Edge Function) can
-- ever write here. Nobody can grant themselves a plan by writing directly.

-- Every account that existed before billing was introduced keeps working
-- without interruption — the admin can revoke this from AdminPanel per
-- account whenever they want.
insert into subscriptions (user_id, status, max_teams)
select id, 'free_override', null from auth.users
on conflict (user_id) do nothing;

-- Every NEW account starts with no access until it pays (or an admin grants
-- free access) — mirrors the same "grant on signup" pattern already used by
-- grant_team_creator_access for teams.
create or replace function public.grant_default_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into subscriptions (user_id, status) values (new.id, 'inactive')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_grant_default_subscription on auth.users;
create trigger trg_grant_default_subscription
  after insert on auth.users
  for each row execute function public.grant_default_subscription_row();

-- True while the account has paid access this season OR an admin marked it
-- free — the single source of truth the app checks before showing the
-- dashboard, and before letting a team be created past the plan's limit.
create or replace function public.user_has_active_plan()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from subscriptions
    where user_id = auth.uid()
      and (
        status = 'free_override'
        or (status = 'active' and (access_until is null or access_until > now()))
      )
  );
$$;

grant execute on function public.user_has_active_plan() to authenticated, anon;
