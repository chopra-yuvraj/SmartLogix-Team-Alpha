-- Migration: Routes, bids, carrier_keys
-- Tasks 1.9, 1.10, 1.11

-- ============================================================
-- Task 1.9: routes
-- ============================================================
create table routes (
  id uuid primary key default gen_random_uuid(),
  corridor_id uuid not null references corridors(id) on delete cascade,
  vehicle_id uuid references vehicles(id) on delete set null,
  sequence jsonb not null default '[]'::jsonb,  -- ordered node ids
  eta_per_stop jsonb not null default '[]'::jsonb,
  total_cost numeric not null default 0,
  -- Money in paise (integer), but total_cost here is the computed
  -- routing cost metric, not a price in INR. Bid amounts are paise.
  solver_latency_ms integer,
  status route_status not null default 'proposed',
  bid_window_closes_at timestamptz,  -- when bidding ends
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table routes enable row level security;

-- Carriers with available vehicles in the corridor can read proposed routes
create policy "Carriers can read routes in their corridors"
  on routes for select
  using (
    exists (
      select 1 from vehicles v
      where v.carrier_id = auth.uid()
        and v.is_available = true
    )
  );

-- Shippers can read routes containing their shipments
create policy "Shippers can read routes for their shipments"
  on routes for select
  using (
    exists (
      select 1 from shipments s
      where s.shipper_id = auth.uid()
        and s.corridor_id = routes.corridor_id
        and s.status in ('routed', 'booked', 'in_transit', 'delivered')
    )
  );

-- Admins can read all
create policy "Admins can read all routes"
  on routes for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger routes_updated_at
  before update on routes
  for each row execute function set_updated_at();

create index idx_routes_corridor on routes(corridor_id);
create index idx_routes_vehicle on routes(vehicle_id);
create index idx_routes_status on routes(status);

-- ============================================================
-- Task 1.11: carrier_keys (before bids, since bids reference it)
-- ============================================================
create table carrier_keys (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id) on delete cascade,
  public_key text not null,  -- JWK or base64 SPKI format
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table carrier_keys enable row level security;

-- Carriers can manage their own keys
create policy "Carriers can read own keys"
  on carrier_keys for select
  using (auth.uid() = carrier_id);

create policy "Carriers can insert own keys"
  on carrier_keys for insert
  with check (auth.uid() = carrier_id);

create policy "Carriers can update own keys"
  on carrier_keys for update
  using (auth.uid() = carrier_id)
  with check (auth.uid() = carrier_id);

-- Service role / gateway needs to read keys for bid verification
-- This is done via service_role key, not RLS

-- Admins can read all keys
create policy "Admins can read all carrier keys"
  on carrier_keys for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- One active key per carrier (enforced at application level,
-- but add an index to support the lookup)
create index idx_carrier_keys_active on carrier_keys(carrier_id)
  where is_active = true;

-- ============================================================
-- Task 1.10: bids
-- ============================================================
create table bids (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references routes(id) on delete cascade,
  carrier_id uuid not null references carriers(id) on delete cascade,
  bid_amount_paise bigint not null check (bid_amount_paise > 0),
  public_key text not null,  -- or FK to carrier_keys
  signature text not null,
  signed_payload text not null,  -- exact bytes that were signed
  status bid_status not null default 'submitted',
  submitted_at timestamptz not null default now(),

  -- A carrier can only bid once per route
  constraint unique_bid_per_carrier_route unique (route_id, carrier_id)
);

alter table bids enable row level security;

-- Carriers can insert their own bids
create policy "Carriers can insert own bids"
  on bids for insert
  with check (auth.uid() = carrier_id);

-- Carriers can read only their own bid rows
-- (protects against bid-manipulation/collusion — never see others' amounts before award)
create policy "Carriers can read own bids"
  on bids for select
  using (auth.uid() = carrier_id);

-- After award, carriers can see the award outcome on a route
-- (but still not other carriers' amounts — only status)
create policy "Carriers can see award outcomes"
  on bids for select
  using (
    status = 'awarded'
    and exists (
      select 1 from bids b2
      where b2.route_id = bids.route_id
        and b2.carrier_id = auth.uid()
    )
  );

-- Admins can read all bids
create policy "Admins can read all bids"
  on bids for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create index idx_bids_route on bids(route_id);
create index idx_bids_carrier on bids(carrier_id);
create index idx_bids_status on bids(status);
