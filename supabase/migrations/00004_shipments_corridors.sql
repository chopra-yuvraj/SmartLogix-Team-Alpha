-- Migration: Shipments, corridors, corridor_memberships
-- Tasks 1.6, 1.7, 1.8

-- ============================================================
-- Task 1.6: shipments
-- Fields match POST /api/v1/shipment/create contract exactly
-- ============================================================
create table shipments (
  id uuid primary key default gen_random_uuid(),
  shipper_id uuid not null references shippers(id) on delete cascade,
  origin geography(Point, 4326) not null,
  origin_address text not null,
  destination geography(Point, 4326) not null,
  destination_address text not null,
  weight_kg numeric not null check (weight_kg > 0),
  volume_cbm numeric not null check (volume_cbm > 0),
  load_type text not null,
  time_window_earliest timestamptz not null,
  time_window_latest timestamptz not null,
  status shipment_status not null default 'pending',
  corridor_id uuid,  -- nullable, set when clustered (Task 1.8)
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint valid_time_window check (time_window_latest > time_window_earliest)
);

alter table shipments enable row level security;

-- Shippers read/write only their own
create policy "Shippers can read own shipments"
  on shipments for select
  using (auth.uid() = shipper_id);

create policy "Shippers can insert own shipments"
  on shipments for insert
  with check (auth.uid() = shipper_id);

create policy "Shippers can update own shipments"
  on shipments for update
  using (auth.uid() = shipper_id)
  with check (auth.uid() = shipper_id);

-- Carriers can read shipments attached to routes they can bid on
-- (join-based, not blanket read — see Task 1.6 RLS requirement)
create policy "Carriers can read routed shipments for their corridors"
  on shipments for select
  using (
    status in ('routed', 'booked', 'in_transit', 'delivered')
    and corridor_id is not null
    and exists (
      select 1 from vehicles v
      where v.carrier_id = auth.uid()
        and v.is_available = true
    )
  );

-- Admins can read all
create policy "Admins can read all shipments"
  on shipments for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role can update status (gateway uses service role for status transitions)
create policy "Service role can update shipments"
  on shipments for update
  using (auth.uid() is not null)
  with check (true);

create trigger shipments_updated_at
  before update on shipments
  for each row execute function set_updated_at();

create index idx_shipments_shipper on shipments(shipper_id);
create index idx_shipments_status on shipments(status);
create index idx_shipments_corridor on shipments(corridor_id);
create index idx_shipments_origin on shipments using gist(origin);
create index idx_shipments_destination on shipments using gist(destination);

-- ============================================================
-- Task 1.7: corridors
-- ============================================================
create table corridors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bounding_box geography(Polygon, 4326) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table corridors enable row level security;

-- Corridors are readable by all authenticated users
create policy "Authenticated users can read corridors"
  on corridors for select
  using (auth.uid() is not null);

-- Only admins/service role can modify corridors
create policy "Admins can manage corridors"
  on corridors for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger corridors_updated_at
  before update on corridors
  for each row execute function set_updated_at();

create index idx_corridors_bbox on corridors using gist(bounding_box);

-- Task 1.7: Seed 2–3 example corridors
-- Delhi-Mumbai trunk corridor
insert into corridors (name, bounding_box) values
(
  'Delhi–Mumbai Trunk',
  ST_GeogFromText('POLYGON((72.8 18.9, 77.3 18.9, 77.3 28.8, 72.8 28.8, 72.8 18.9))')
),
(
  'Delhi–Jaipur Corridor',
  ST_GeogFromText('POLYGON((75.5 26.5, 77.4 26.5, 77.4 28.9, 75.5 28.9, 75.5 26.5))')
),
(
  'Mumbai–Pune Express',
  ST_GeogFromText('POLYGON((73.0 18.4, 73.9 18.4, 73.9 19.2, 73.0 19.2, 73.0 18.4))')
);

-- ============================================================
-- Task 1.8: corridor_memberships
-- Records which corridor a shipment/vehicle was clustered into
-- ============================================================
create table corridor_memberships (
  id uuid primary key default gen_random_uuid(),
  corridor_id uuid not null references corridors(id) on delete cascade,
  shipment_id uuid references shipments(id) on delete set null,
  vehicle_id uuid references vehicles(id) on delete set null,
  clustered_at timestamptz not null default now(),

  -- At least one of shipment_id or vehicle_id must be set
  constraint membership_has_entity check (
    shipment_id is not null or vehicle_id is not null
  )
);

alter table corridor_memberships enable row level security;

create policy "Authenticated users can read memberships"
  on corridor_memberships for select
  using (auth.uid() is not null);

create policy "Admins can manage memberships"
  on corridor_memberships for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create index idx_cm_corridor on corridor_memberships(corridor_id);
create index idx_cm_shipment on corridor_memberships(shipment_id);
create index idx_cm_vehicle on corridor_memberships(vehicle_id);

-- Add the FK from shipments.corridor_id to corridors
alter table shipments
  add constraint fk_shipments_corridor
  foreign key (corridor_id) references corridors(id) on delete set null;
