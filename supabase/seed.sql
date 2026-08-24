-- SmartLogix — Seed Data
-- Task 1.18: Realistic demo data for development and testing
--
-- This seed creates:
--   - 3 shippers, 3 carriers (with profiles)
--   - 5 vehicles with locations inside the Delhi-Mumbai corridor
--   - 15 shipments with varied time windows
--
-- NOTE: This uses fixed UUIDs so the seed is idempotent.
-- Auth users must be created separately via Supabase Auth
-- (or via supabase/seed.sql in local dev where auth.users is accessible).

-- ============================================================
-- Demo auth users (only works with local Supabase / test environment)
-- In production, create users via Supabase Auth UI or API.
-- ============================================================

-- Generate predictable UUIDs for demo
-- Shippers: s1, s2, s3
-- Carriers: c1, c2, c3

do $$
declare
  s1_id uuid := '11111111-1111-1111-1111-111111111111';
  s2_id uuid := '22222222-2222-2222-2222-222222222222';
  s3_id uuid := '33333333-3333-3333-3333-333333333333';
  c1_id uuid := '44444444-4444-4444-4444-444444444444';
  c2_id uuid := '55555555-5555-5555-5555-555555555555';
  c3_id uuid := '66666666-6666-6666-6666-666666666666';
  corridor_dm_id uuid;
begin
  -- Get the Delhi-Mumbai corridor ID
  select id into corridor_dm_id from corridors where name = 'Delhi–Mumbai Trunk' limit 1;

  -- ============================================================
  -- Insert auth.users (local dev only — will fail on hosted Supabase)
  -- ============================================================
  begin
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, role)
    values
      (s1_id, 'shipper1@demo.smartlogix.dev', crypt('demo1234', gen_salt('bf')), now(), 'authenticated'),
      (s2_id, 'shipper2@demo.smartlogix.dev', crypt('demo1234', gen_salt('bf')), now(), 'authenticated'),
      (s3_id, 'shipper3@demo.smartlogix.dev', crypt('demo1234', gen_salt('bf')), now(), 'authenticated'),
      (c1_id, 'driver1@demo.smartlogix.dev',  crypt('demo1234', gen_salt('bf')), now(), 'authenticated'),
      (c2_id, 'driver2@demo.smartlogix.dev',  crypt('demo1234', gen_salt('bf')), now(), 'authenticated'),
      (c3_id, 'driver3@demo.smartlogix.dev',  crypt('demo1234', gen_salt('bf')), now(), 'authenticated')
    on conflict (id) do nothing;
  exception when others then
    raise notice 'Could not insert auth.users — likely running on hosted Supabase. Create users manually via Auth UI.';
  end;

  -- ============================================================
  -- Profiles
  -- ============================================================
  insert into profiles (id, role, full_name, phone, preferred_language) values
    (s1_id, 'shipper', 'Rajesh Kumar',    '+919876543210', 'en'),
    (s2_id, 'shipper', 'Priya Sharma',    '+919876543211', 'hi'),
    (s3_id, 'shipper', 'Vikram Industries', '+919876543212', 'en'),
    (c1_id, 'driver',  'Amit Singh',      '+919876543213', 'hi'),
    (c2_id, 'driver',  'Suresh Yadav',    '+919876543214', 'hi'),
    (c3_id, 'driver',  'Mohammed Khan',   '+919876543215', 'en')
  on conflict (id) do nothing;

  -- ============================================================
  -- Shippers
  -- ============================================================
  insert into shippers (id, business_name, gstin, default_pickup_address, default_pickup_location) values
    (s1_id, 'Kumar Textiles Pvt Ltd', '07AABCU9603R1ZM', 'Plot 42, Okhla Industrial Area, New Delhi',
      ST_GeogFromText('POINT(77.2727 28.5355)')),
    (s2_id, 'Sharma Electronics', null, 'Nehru Place, New Delhi',
      ST_GeogFromText('POINT(77.2507 28.5494)')),
    (s3_id, 'Vikram Industries', '27AADCV0325R1Z4', 'MIDC Andheri, Mumbai',
      ST_GeogFromText('POINT(72.8497 19.1136)'))
  on conflict (id) do nothing;

  -- ============================================================
  -- Carriers
  -- ============================================================
  insert into carriers (id, company_name, fleet_size) values
    (c1_id, 'Amit Transport Co.', 3),
    (c2_id, 'Suresh Logistics', 5),
    (c3_id, 'Khan Freight Services', 2)
  on conflict (id) do nothing;

  -- ============================================================
  -- Vehicles (inside Delhi-Mumbai corridor)
  -- ============================================================
  insert into vehicles (carrier_id, capacity_kg, capacity_cbm, vehicle_type, registration_number, current_location, is_available) values
    -- Amit's fleet
    (c1_id, 5000, 20, 'Medium Truck', 'DL01AB1234',
      ST_GeogFromText('POINT(77.1025 28.7041)'), true),   -- Delhi
    (c1_id, 10000, 40, 'Heavy Truck', 'DL01CD5678',
      ST_GeogFromText('POINT(76.7794 28.4595)'), true),   -- Gurgaon

    -- Suresh's fleet
    (c2_id, 3000, 15, 'Light Truck', 'RJ14EF9012',
      ST_GeogFromText('POINT(75.7873 26.9124)'), true),   -- Jaipur
    (c2_id, 8000, 35, 'Heavy Truck', 'MH01GH3456',
      ST_GeogFromText('POINT(72.8777 19.0760)'), true),   -- Mumbai

    -- Khan's fleet
    (c3_id, 6000, 25, 'Medium Truck', 'GJ01IJ7890',
      ST_GeogFromText('POINT(72.5714 23.0225)'), true)    -- Ahmedabad
  on conflict (registration_number) do nothing;

  -- ============================================================
  -- Shipments (varied origins, destinations, time windows)
  -- ============================================================
  insert into shipments (shipper_id, origin, origin_address, destination, destination_address,
    weight_kg, volume_cbm, load_type, time_window_earliest, time_window_latest, status, corridor_id) values

    -- Kumar Textiles shipments (Delhi → various)
    (s1_id,
      ST_GeogFromText('POINT(77.2727 28.5355)'), 'Okhla, Delhi',
      ST_GeogFromText('POINT(72.8777 19.0760)'), 'Andheri, Mumbai',
      500, 2.5, 'Textiles',
      now() + interval '2 hours', now() + interval '48 hours',
      'pending', corridor_dm_id),

    (s1_id,
      ST_GeogFromText('POINT(77.2727 28.5355)'), 'Okhla, Delhi',
      ST_GeogFromText('POINT(72.8777 19.0760)'), 'Worli, Mumbai',
      800, 4.0, 'Garments',
      now() + interval '3 hours', now() + interval '36 hours',
      'pending', corridor_dm_id),

    (s1_id,
      ST_GeogFromText('POINT(77.2727 28.5355)'), 'Okhla, Delhi',
      ST_GeogFromText('POINT(75.7873 26.9124)'), 'MI Road, Jaipur',
      300, 1.5, 'Fabrics',
      now() + interval '1 hour', now() + interval '24 hours',
      'pending', null),

    (s1_id,
      ST_GeogFromText('POINT(77.2727 28.5355)'), 'Okhla, Delhi',
      ST_GeogFromText('POINT(72.5714 23.0225)'), 'CG Road, Ahmedabad',
      1200, 6.0, 'Textiles',
      now() + interval '4 hours', now() + interval '72 hours',
      'pending', corridor_dm_id),

    -- Sharma Electronics shipments
    (s2_id,
      ST_GeogFromText('POINT(77.2507 28.5494)'), 'Nehru Place, Delhi',
      ST_GeogFromText('POINT(72.8777 19.0760)'), 'Lamington Road, Mumbai',
      200, 1.0, 'Electronics',
      now() + interval '1 hour', now() + interval '24 hours',
      'pending', corridor_dm_id),

    (s2_id,
      ST_GeogFromText('POINT(77.2507 28.5494)'), 'Nehru Place, Delhi',
      ST_GeogFromText('POINT(73.8567 18.5204)'), 'Deccan, Pune',
      150, 0.8, 'Electronics',
      now() + interval '2 hours', now() + interval '30 hours',
      'pending', null),

    (s2_id,
      ST_GeogFromText('POINT(77.2507 28.5494)'), 'Nehru Place, Delhi',
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'MIDC Andheri, Mumbai',
      400, 2.0, 'Computer Parts',
      now() + interval '6 hours', now() + interval '48 hours',
      'pending', corridor_dm_id),

    (s2_id,
      ST_GeogFromText('POINT(77.2507 28.5494)'), 'Nehru Place, Delhi',
      ST_GeogFromText('POINT(77.5946 12.9716)'), 'Koramangala, Bangalore',
      350, 1.8, 'Electronics',
      now() + interval '4 hours', now() + interval '72 hours',
      'pending', null),

    -- Vikram Industries shipments (Mumbai → various)
    (s3_id,
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'MIDC Andheri, Mumbai',
      ST_GeogFromText('POINT(77.2090 28.6139)'), 'Connaught Place, Delhi',
      2000, 10.0, 'Industrial Parts',
      now() + interval '3 hours', now() + interval '60 hours',
      'pending', corridor_dm_id),

    (s3_id,
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'MIDC Andheri, Mumbai',
      ST_GeogFromText('POINT(77.1025 28.7041)'), 'Karol Bagh, Delhi',
      1500, 7.5, 'Machine Components',
      now() + interval '2 hours', now() + interval '48 hours',
      'pending', corridor_dm_id),

    (s3_id,
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'MIDC Andheri, Mumbai',
      ST_GeogFromText('POINT(72.5714 23.0225)'), 'Naroda, Ahmedabad',
      800, 4.0, 'Raw Materials',
      now() + interval '5 hours', now() + interval '36 hours',
      'pending', null),

    (s3_id,
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'MIDC Andheri, Mumbai',
      ST_GeogFromText('POINT(73.8567 18.5204)'), 'Pimpri, Pune',
      600, 3.0, 'Spare Parts',
      now() + interval '1 hour', now() + interval '12 hours',
      'pending', null),

    -- More Delhi shipments for clustering density
    (s1_id,
      ST_GeogFromText('POINT(77.3178 28.6692)'), 'Patparganj, Delhi',
      ST_GeogFromText('POINT(72.8777 19.0760)'), 'BKC, Mumbai',
      450, 2.2, 'Textiles',
      now() + interval '2 hours', now() + interval '40 hours',
      'pending', corridor_dm_id),

    (s2_id,
      ST_GeogFromText('POINT(77.2167 28.6667)'), 'Karol Bagh, Delhi',
      ST_GeogFromText('POINT(72.8497 19.1136)'), 'Goregaon, Mumbai',
      250, 1.2, 'Electronics',
      now() + interval '3 hours', now() + interval '36 hours',
      'pending', corridor_dm_id),

    (s1_id,
      ST_GeogFromText('POINT(77.2885 28.5245)'), 'Sarita Vihar, Delhi',
      ST_GeogFromText('POINT(72.8350 19.0176)'), 'Lower Parel, Mumbai',
      700, 3.5, 'Mixed Cargo',
      now() + interval '1 hour', now() + interval '48 hours',
      'pending', corridor_dm_id);

end $$;
