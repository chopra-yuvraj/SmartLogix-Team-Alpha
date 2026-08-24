-- Migration: Storage buckets and PostGIS helper function
-- Tasks 1.16, 1.17

-- ============================================================
-- Task 1.16: Supabase Storage buckets
-- Both private by default, with signed-URL access only.
-- Storage policies enforce access control (same rigor as table RLS).
-- ============================================================

-- Create buckets via Supabase SQL (storage schema)
insert into storage.buckets (id, name, public)
values
  ('proof-of-delivery', 'proof-of-delivery', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- Storage policies for proof-of-delivery bucket
-- Drivers can upload PoD images
create policy "Drivers can upload PoD images"
  on storage.objects for insert
  with check (
    bucket_id = 'proof-of-delivery'
    and auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'driver'
    )
  );

-- Shippers can read PoD images for their shipments (via signed URL)
create policy "Authenticated users can read PoD images"
  on storage.objects for select
  using (
    bucket_id = 'proof-of-delivery'
    and auth.uid() is not null
  );

-- Storage policies for certificates bucket
-- Only service role writes certificates (gateway generates PDFs)
-- All authenticated users can read their certificates
create policy "Authenticated users can read certificates"
  on storage.objects for select
  using (
    bucket_id = 'certificates'
    and auth.uid() is not null
  );

-- ============================================================
-- Task 1.17: PostGIS helper function
-- nearby_shipments_and_vehicles(corridor_bbox, buffer_m)
-- Used by clustering step in Phase 4 (services/clustering.py)
-- ============================================================

create or replace function nearby_shipments_and_vehicles(
  corridor_bbox geography,
  buffer_m integer default 50000  -- 50km default buffer
)
returns table (
  entity_type text,
  entity_id uuid,
  entity_location geography,
  -- Shipment-specific fields (null for vehicles)
  shipment_weight_kg numeric,
  shipment_volume_cbm numeric,
  shipment_status shipment_status,
  shipment_time_earliest timestamptz,
  shipment_time_latest timestamptz,
  -- Vehicle-specific fields (null for shipments)
  vehicle_capacity_kg numeric,
  vehicle_capacity_cbm numeric,
  vehicle_carrier_id uuid,
  vehicle_type text
)
language sql
stable  -- does not modify data
as $$
  -- Return pending shipments within the corridor bounding box + buffer
  select
    'shipment'::text as entity_type,
    s.id as entity_id,
    s.origin as entity_location,
    s.weight_kg as shipment_weight_kg,
    s.volume_cbm as shipment_volume_cbm,
    s.status as shipment_status,
    s.time_window_earliest as shipment_time_earliest,
    s.time_window_latest as shipment_time_latest,
    null::numeric as vehicle_capacity_kg,
    null::numeric as vehicle_capacity_cbm,
    null::uuid as vehicle_carrier_id,
    null::text as vehicle_type
  from shipments s
  where s.status = 'pending'
    and ST_DWithin(s.origin, corridor_bbox, buffer_m)

  union all

  -- Return available vehicles within the corridor bounding box + buffer
  select
    'vehicle'::text as entity_type,
    v.id as entity_id,
    v.current_location as entity_location,
    null::numeric as shipment_weight_kg,
    null::numeric as shipment_volume_cbm,
    null::shipment_status as shipment_status,
    null::timestamptz as shipment_time_earliest,
    null::timestamptz as shipment_time_latest,
    v.capacity_kg as vehicle_capacity_kg,
    v.capacity_cbm as vehicle_capacity_cbm,
    v.carrier_id as vehicle_carrier_id,
    v.vehicle_type as vehicle_type
  from vehicles v
  where v.is_available = true
    and v.current_location is not null
    and ST_DWithin(v.current_location, corridor_bbox, buffer_m);
$$;

-- Grant execute to authenticated users (RLS on underlying tables still applies)
grant execute on function nearby_shipments_and_vehicles(geography, integer) to authenticated;
