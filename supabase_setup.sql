-- Run this in Supabase SQL Editor

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
  final_summary text default ''
);

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
