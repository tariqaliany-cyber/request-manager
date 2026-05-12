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
