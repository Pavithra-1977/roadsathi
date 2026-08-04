-- RoadSathi schema
-- Paste this whole file into the Supabase SQL editor and hit Run.

create table if not exists assistance_requests (
  id                text primary key,
  created_at        timestamptz not null default now(),
  status            text not null default 'open',

  customer_name     text not null,
  customer_phone    text not null,
  passengers        int  not null default 1,
  has_children      boolean not null default false,

  lat               double precision not null,
  lng               double precision not null,
  highway_ref       text,

  vehicle_type      text not null,
  vehicle_model     text,
  vehicle_plate     text,

  symptom_text      text,
  triage            jsonb,
  parts_plan        jsonb,

  mechanic_id       text,
  mechanic          jsonb,
  eta_minutes       int,
  quoted_price_inr  int,

  otp               text not null,
  otp_verified      boolean not null default false,
  guardian_token    text not null,
  guardian_phone    text,

  plan_b            jsonb,
  resolution_note   text,
  timeline          jsonb not null default '[]'::jsonb
);

create index if not exists idx_requests_status     on assistance_requests (status);
create index if not exists idx_requests_created    on assistance_requests (created_at desc);
create index if not exists idx_requests_guardian   on assistance_requests (guardian_token);
-- Bounding-box prefilter for "mechanics near this incident" queries.
create index if not exists idx_requests_latlng     on assistance_requests (lat, lng);

-- Live updates for the tracking screen and the mechanic job board.
alter publication supabase_realtime add table assistance_requests;

-- Demo-friendly access. For production, replace with policies keyed to
-- auth.uid() for customers and a mechanics role for the job board.
alter table assistance_requests enable row level security;

drop policy if exists "demo read"  on assistance_requests;
drop policy if exists "demo write" on assistance_requests;

create policy "demo read"  on assistance_requests for select using (true);
create policy "demo write" on assistance_requests for all    using (true) with check (true);
