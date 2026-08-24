-- Migration: Create custom enum types
-- Used across multiple tables

-- Task 1.2: User roles
create type user_role as enum ('shipper', 'driver', 'admin');

-- Task 1.6: Shipment lifecycle states
create type shipment_status as enum (
  'pending',
  'clustered',
  'routed',
  'booked',
  'in_transit',
  'delivered',
  'cancelled'
);

-- Task 1.9: Route lifecycle states
create type route_status as enum ('proposed', 'awarded', 'active', 'completed');

-- Task 1.10: Bid states
create type bid_status as enum ('submitted', 'awarded', 'rejected');

-- Task 1.14: Notification channels and states
create type notification_channel as enum ('push', 'sms', 'whatsapp', 'in_app');
create type notification_status as enum ('queued', 'sent', 'failed');
