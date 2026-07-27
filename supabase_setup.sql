-- Run this in Supabase SQL Editor
--
-- Schema history note (added during the redesign audit): this file's
-- `requests` CREATE TABLE was missing invoice_amount and
-- progress_percentage, even though both are used throughout the app and
-- exist on the live table — they were added to production via ad-hoc
-- ALTERs at some point and never backfilled into this file. The ALTERs
-- below make this file match production; CREATE TABLE IF NOT EXISTS
-- alone would NOT have added them to an already-existing table.
-- See supabase_migration_v2.sql for the redesign's newer additions
-- (priority, payment_status, payment_date, internal_accounting_note,
-- due_date, activity_log) — not duplicated here to avoid drift between
-- the two files.

create table if not exists requests (
  id text primary key,
  created_at timestamptz default now(),
  status text default 'received',
  branch_number text not null,
  location_link text default '',
  problem_description text default '',
  problem_photos jsonb default '[]',
  created_by text default 'essa',
  assigned_to text,
  internal_notes text default '',
  notes_to_majed text default '',
  notes_to_essa text default '',
  show_work_done_to_essa boolean default false,
  show_completion_photos_to_essa boolean default false,
  majed_started boolean default false,
  majed_comments jsonb default '[]',
  progress_photos jsonb default '[]',
  completion_photos jsonb default '[]',
  work_done text default '',
  final_summary text default '',
  invoice_amount numeric,
  progress_percentage integer default 0
);

-- Additive — safe to run even if the table already exists without these:
alter table requests add column if not exists invoice_amount numeric;
alter table requests add column if not exists progress_percentage integer default 0;

alter table requests enable row level security;

create policy "Allow all" on requests for all using (true) with check (true);

-- ── Performance indexes ───────────────────────────────────────────
-- Speeds up the list/filter queries in getRequestListItems (storage.js):
-- filtering by branch, status, assigned worker, and sorting by date.
-- id (request number) is the primary key and already indexed.
create index if not exists requests_branch_number_idx on requests(branch_number);
create index if not exists requests_status_idx        on requests(status);
create index if not exists requests_assigned_to_idx   on requests(assigned_to);
create index if not exists requests_created_at_idx    on requests(created_at desc);

-- ── Delivery Notes (Tariq-only feature) ──────────────────────────
-- CONFIRMED MISSING IN PRODUCTION (found during the redesign audit): a
-- live REST query for this table returns PGRST205 "Could not find the
-- table 'public.delivery_notes'" — meaning this section of the file was
-- apparently never run against the production database, even though the
-- Delivery Note feature has been merged and deployed for a while. The
-- app degrades gracefully (shows "No delivery notes yet" instead of an
-- error), so this went unnoticed. Run this file to fix it.
--
-- Same "allow all" RLS pattern as `requests` above — this app has no
-- real per-user Supabase Auth session to key row-level policies off of,
-- so access control for this feature is enforced in the React app
-- (canManageDeliveryNotes in src/storage.js), not at this layer.
create table if not exists delivery_notes (
  id text primary key,
  number text unique not null,
  request_id text references requests(id),
  status text default 'draft',
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  branch_number text default '',
  branch_name text default '',
  branch_location text default '',
  request_date text default '',
  completion_date text default '',
  wrp_number text default '',
  items jsonb default '[]',
  general_remarks text default ''
);

alter table delivery_notes enable row level security;

create policy "Allow all" on delivery_notes for all using (true) with check (true);

-- ── BOQ Library (custom items saved for reuse across delivery notes) ──
-- Populated only when the user explicitly clicks "Save to BOQ Library"
-- on a custom item — never written to automatically.
create table if not exists boq_library_items (
  id text primary key,
  item_no text default '',
  category text default 'Custom',
  description text not null,
  unit text default '',
  created_by text,
  created_at timestamptz default now()
);

alter table boq_library_items enable row level security;

create policy "Allow all" on boq_library_items for all using (true) with check (true);

-- ── Notifications — superseded, do not recreate ──────────────────
-- An earlier `notifications` table (req_id, branch_number,
-- problem_description, actor, action, detail, created_at) existed in
-- production but was never added to this file either. It's now replaced
-- by `activity_log` (see supabase_migration_v2.sql), which supports a
-- per-request timeline instead of only a global feed and doesn't
-- denormalize branch_number/problem_description onto every row. Left
-- alone (not dropped) so no historical data is lost; the app no longer
-- reads or writes it.

-- If you already ran an earlier version of this migration (with
-- contact_person/po_number/wo_number/signature/client_name columns), drop
-- the now-unused columns instead of re-running the create table above:
-- alter table delivery_notes
--   drop column if exists contact_person,
--   drop column if exists po_number,
--   drop column if exists wo_number,
--   drop column if exists delivered_by_name,
--   drop column if exists delivered_by_position,
--   drop column if exists delivered_by_date,
--   drop column if exists received_by_name,
--   drop column if exists received_by_position,
--   drop column if exists received_by_date,
--   drop column if exists branch_manager_name,
--   drop column if exists branch_manager_date,
--   drop column if exists client_name;
