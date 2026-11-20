-- Migration v5 — Technician live tracking ("متوجه للفرع")
-- Run this in the Supabase SQL Editor. Purely additive.
--
-- A trip starts when a technician presses «تم قبول الطلب» on a job, and ends
-- when he presses «تم الوصول» (arrived) or cancels. While it is en_route the
-- technician's phone writes its latest position into the row, and Tariq's
-- dashboard follows the row through Supabase Realtime.
--
-- Only the latest position is kept (no location history).
-- Deleting a request deletes its trips (cascade), which removes it from the
-- dashboard box.

create table if not exists technician_trips (
  id               uuid primary key default gen_random_uuid(),
  request_id       text not null references requests(id) on delete cascade,
  technician       text not null,               -- username, e.g. 'majed'
  technician_name  text default '',             -- display name (Arabic)
  status           text not null default 'en_route'
                   check (status in ('en_route', 'arrived', 'cancelled')),
  accepted_at      timestamptz not null default now(),
  ended_at         timestamptz,
  lat              double precision,
  lng              double precision,
  accuracy         real,                        -- metres
  heading          real,                        -- degrees, when moving
  speed            real,                        -- m/s, when moving
  location_at      timestamptz                  -- when the phone took the fix
);

-- One active trip per request, and quick lookups of active trips.
create unique index if not exists technician_trips_one_active_per_request
  on technician_trips (request_id) where status = 'en_route';
create index if not exists technician_trips_active
  on technician_trips (status) where status = 'en_route';

-- Same access model as the rest of the app's tables (anon key, app-level roles).
alter table technician_trips enable row level security;
drop policy if exists "Allow all" on technician_trips;
create policy "Allow all" on technician_trips for all using (true) with check (true);

-- Push row changes to the dashboard in real time.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'technician_trips'
  ) then
    alter publication supabase_realtime add table technician_trips;
  end if;
end $$;
