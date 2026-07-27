-- Migration v2 — Redesign support (run this in Supabase SQL Editor)
--
-- Purely additive: no columns are dropped, no existing rows are modified
-- beyond receiving default values for the new columns below. Safe to run
-- against the live database at any time.
--
-- Note on supabase_setup.sql drift: the live `requests` table already has
-- an `invoice_amount` column (numeric, used throughout the app) and a
-- `notifications` table (used by createNotification/getNotifications in
-- storage.js) that were never added to supabase_setup.sql when originally
-- created. Both are left as-is here — not reintroduced destructively —
-- but are documented in this file so the schema history is accurate.
-- `notifications` is superseded going forward by `activity_log` below
-- (see storage.js logActivity/getActivityLog); it is not dropped.

-- ── New optional fields on requests ──────────────────────────────
alter table requests add column if not exists priority                 text default 'normal';
alter table requests add column if not exists payment_status           text default 'unpaid';
alter table requests add column if not exists payment_date             timestamptz;
alter table requests add column if not exists internal_accounting_note text default '';
alter table requests add column if not exists due_date                 date;

create index if not exists requests_priority_idx on requests(priority);
create index if not exists requests_due_date_idx  on requests(due_date);

-- ── Activity log (replaces `notifications` as the write target going
--    forward; supports a per-request timeline, not just a global feed) ──
create table if not exists activity_log (
  id          text primary key,
  request_id  text references requests(id),
  action      text not null,
  actor       text default '',
  actor_role  text default '',
  detail      text default '',
  notify      boolean default false,
  created_at  timestamptz default now()
);

alter table activity_log enable row level security;

create policy "Allow all" on activity_log for all using (true) with check (true);

create index if not exists activity_log_request_id_idx on activity_log(request_id);
create index if not exists activity_log_created_at_idx on activity_log(created_at desc);
