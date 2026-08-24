-- Migration: Telemetry, green_credits, notifications, proof_of_delivery
-- Tasks 1.12, 1.13, 1.14, 1.15

-- ============================================================
-- Task 1.12: telemetry_pings
-- Plain Postgres with BRIN index (TimescaleDB substitute — see rules.md)
-- If migrating to self-hosted Supabase (Docker), TimescaleDB can be
-- re-introduced as a hypertable on this table.
-- ============================================================
create table telemetry_pings (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  location geography(Point, 4326) not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- BRIN index on recorded_at for efficient time-range queries
-- (substitute for TimescaleDB time-series indexing)
create index idx_telemetry_recorded_brin on telemetry_pings
  using brin(recorded_at);

create index idx_telemetry_route on telemetry_pings(route_id);
create index idx_telemetry_vehicle on telemetry_pings(vehicle_id);

alter table telemetry_pings enable row level security;

-- Drivers can insert telemetry for their own vehicles
create policy "Drivers can insert own telemetry"
  on telemetry_pings for insert
  with check (
    exists (
      select 1 from vehicles v
      where v.id = vehicle_id
        and v.carrier_id = auth.uid()
    )
  );

-- Shippers can read telemetry for routes containing their shipments
create policy "Shippers can read telemetry for their routes"
  on telemetry_pings for select
  using (
    exists (
      select 1 from routes r
      join shipments s on s.corridor_id = r.corridor_id
      where r.id = telemetry_pings.route_id
        and s.shipper_id = auth.uid()
        and s.status in ('in_transit', 'delivered')
    )
  );

-- Carriers can read telemetry for their own vehicles
create policy "Carriers can read own vehicle telemetry"
  on telemetry_pings for select
  using (
    exists (
      select 1 from vehicles v
      where v.id = telemetry_pings.vehicle_id
        and v.carrier_id = auth.uid()
    )
  );

-- Admins can read all
create policy "Admins can read all telemetry"
  on telemetry_pings for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Task 1.13: green_credits
-- ============================================================
create table green_credits (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  deadhead_km_saved numeric not null default 0,
  load_factor numeric not null default 0,
  emission_factor_used numeric not null,  -- kg CO₂e per tonne-km
  co2e_kg_saved numeric not null default 0,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table green_credits enable row level security;

-- Readable by all authenticated users (ESG transparency)
create policy "Authenticated users can read green credits"
  on green_credits for select
  using (auth.uid() is not null);

-- Only gateway (service role) can insert
-- No user-facing insert policy needed

-- Admins can manage
create policy "Admins can manage green credits"
  on green_credits for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create index idx_green_credits_route on green_credits(route_id);

-- ============================================================
-- Task 1.14: notifications
-- ============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  channel notification_channel not null,
  payload jsonb not null default '{}'::jsonb,
  status notification_status not null default 'queued',
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

-- Users can only read their own notifications
create policy "Users can read own notifications"
  on notifications for select
  using (auth.uid() = profile_id);

-- Users can update (mark read) their own notifications
create policy "Users can update own notifications"
  on notifications for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Only gateway (service role) inserts notifications
-- No user-facing insert policy needed

create index idx_notifications_profile on notifications(profile_id);
create index idx_notifications_status on notifications(status);

-- ============================================================
-- Task 1.15: proof_of_delivery
-- ============================================================
create table proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade unique,
  image_path text,  -- Supabase Storage path
  signed_by text,
  delivered_at timestamptz not null default now(),
  certificate_path text,  -- green-mileage certificate PDF path
  created_at timestamptz not null default now()
);

alter table proof_of_delivery enable row level security;

-- Shippers can read PoD for their shipments
create policy "Shippers can read own PoD"
  on proof_of_delivery for select
  using (
    exists (
      select 1 from shipments s
      where s.id = proof_of_delivery.shipment_id
        and s.shipper_id = auth.uid()
    )
  );

-- Drivers can insert PoD for shipments on their active routes
create policy "Drivers can insert PoD for active routes"
  on proof_of_delivery for insert
  with check (
    exists (
      select 1 from shipments s
      join routes r on r.corridor_id = s.corridor_id
      join vehicles v on v.id = r.vehicle_id
      where s.id = shipment_id
        and v.carrier_id = auth.uid()
        and r.status = 'active'
    )
  );

-- Admins can read all
create policy "Admins can read all PoD"
  on proof_of_delivery for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create index idx_pod_shipment on proof_of_delivery(shipment_id);
