-- Migration: Enable PostGIS extension
-- Task 1.1: Enable the postgis extension for geographic data types

create extension if not exists postgis;

-- Verify PostGIS is available
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'postgis') then
    raise exception 'PostGIS extension failed to install';
  end if;
end $$;
