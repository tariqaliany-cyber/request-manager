-- Migration v3 — Price List (Tariq-only, confidential)
--
-- SECURITY MODEL
-- The rest of this app uses "allow all" RLS because it has no real Supabase
-- Auth session. Price List data is different: it is locked to ONE real
-- Supabase Auth account (Tariq's). Everyone else — Essa, Majed, Abdullah,
-- or anyone holding only the public anon key — gets zero rows and cannot
-- write, whatever they call (REST, direct URL, console).
--
--   * RLS is on and there are NO policies for the `anon` role.
--   * Table privileges are revoked from anon/public.
--   * `authenticated` may only SELECT, and only when is_price_list_user().
--   * No insert/update/delete from clients at all; data is loaded by an admin.
--
-- Tariq's Auth account is created separately (see bottom of file) so that no
-- password is ever stored in this repository. Supabase hashes it (bcrypt).

create table if not exists price_list_items (
  id                 text primary key,
  list_key           text not null check (list_key in ('hvac','mep','proj_signs','maint_signs')),
  sort_order         integer not null,
  item_no            text default '',
  description        text default '',
  description_ar     text default '',
  category           text default '',
  section            text default '',
  section_note       text default '',
  parent_description text default '',
  size_spec          text default '',
  made_in            text default '',
  unit               text default '',
  lead_time          text default '',
  price              numeric not null
);
create index if not exists price_list_items_list_idx on price_list_items(list_key, sort_order);

-- Single source of truth for "who is Tariq": the Auth user with this email.
create or replace function public.is_price_list_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email = 'tariq@request-manager.example'
  );
$$;
revoke all on function public.is_price_list_user() from public, anon;
grant execute on function public.is_price_list_user() to authenticated;

alter table price_list_items enable row level security;
revoke all on price_list_items from anon, public;
revoke all on price_list_items from authenticated;
grant select on price_list_items to authenticated;

drop policy if exists "Tariq reads price list" on price_list_items;
create policy "Tariq reads price list" on price_list_items
  for select to authenticated
  using (public.is_price_list_user());

-- ── Tariq's Auth account (run once, by an admin, with the real password) ──
-- insert into auth.users (...) / auth.identities (...) with
--   encrypted_password = extensions.crypt('<password>', extensions.gen_salt('bf'))
-- email: tariq@request-manager.example
-- Also turn OFF "Allow new users to sign up" in Supabase → Authentication.
