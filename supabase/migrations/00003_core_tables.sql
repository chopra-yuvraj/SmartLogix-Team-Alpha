-- Migration: Core tables — profiles, shippers, carriers, vehicles
-- Tasks 1.2–1.5

-- ============================================================
-- Task 1.2: profiles (linked 1:1 to auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- RLS: users read/update only their own row; admins read all
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- Trigger to auto-set updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================
-- Task 1.3: shippers
-- ============================================================
create table shippers (
  id uuid primary key references profiles(id) on delete cascade,
  business_name text not null,
  gstin text,  -- optional
  default_pickup_address text,
  default_pickup_location geography(Point, 4326),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table shippers enable row level security;

create policy "Shippers can read own record"
  on shippers for select
  using (auth.uid() = id);

create policy "Shippers can update own record"
  on shippers for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Shippers can insert own record"
  on shippers for insert
  with check (auth.uid() = id);

create policy "Admins can read all shippers"
  on shippers for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger shippers_updated_at
  before update on shippers
  for each row execute function set_updated_at();

-- ============================================================
-- Task 1.4: carriers
-- ============================================================
create table carriers (
  id uuid primary key references profiles(id) on delete cascade,
  company_name text not null,
  fleet_size integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table carriers enable row level security;

create policy "Carriers can read own record"
  on carriers for select
  using (auth.uid() = id);

create policy "Carriers can update own record"
  on carriers for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Carriers can insert own record"
  on carriers for insert
  with check (auth.uid() = id);

create policy "Admins can read all carriers"
  on carriers for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

create trigger carriers_updated_at
  before update on carriers
  for each row execute function set_updated_at();

-- ============================================================
-- Task 1.5: vehicles
-- ============================================================
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references carriers(id) on delete cascade,
  capacity_kg numeric not null check (capacity_kg > 0),
  capacity_cbm numeric not null check (capacity_cbm > 0),
  vehicle_type text not null,
  registration_number text not null unique,
  current_location geography(Point, 4326),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table vehicles enable row level security;

-- Carriers manage only their own vehicles
create policy "Carriers can read own vehicles"
  on vehicles for select
  using (auth.uid() = carrier_id);

create policy "Carriers can insert own vehicles"
  on vehicles for insert
  with check (auth.uid() = carrier_id);

create policy "Carriers can update own vehicles"
  on vehicles for update
  using (auth.uid() = carrier_id)
  with check (auth.uid() = carrier_id);

create policy "Carriers can delete own vehicles"
  on vehicles for delete
  using (auth.uid() = carrier_id);

-- Admins can read all vehicles
create policy "Admins can read all vehicles"
  on vehicles for select
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Shippers/other carriers CANNOT read another carrier's raw location
-- (no blanket select policy for non-carrier/non-admin roles)

create trigger vehicles_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

create index idx_vehicles_carrier on vehicles(carrier_id);
create index idx_vehicles_location on vehicles using gist(current_location);
create index idx_vehicles_available on vehicles(is_available) where is_available = true;
