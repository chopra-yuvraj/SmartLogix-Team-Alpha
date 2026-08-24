/**
 * SmartLogix — Shared API Contract Schemas
 *
 * These Zod schemas define the canonical shapes for the two primary
 * API contracts from the project report (Section 3.3):
 *   - POST /api/v1/shipment/create
 *   - POST /api/v1/route/optimize
 *
 * Corresponding Pydantic models in apps/gateway must match these
 * field names exactly. Extensions (extra fields) are allowed;
 * renames or removals are not (rules.md §3.7).
 */

import { z } from "zod";

// ============================================================
// Enums
// ============================================================

export const ShipmentStatus = z.enum([
  "pending",
  "clustered",
  "routed",
  "booked",
  "in_transit",
  "delivered",
  "cancelled",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatus>;

export const RouteStatus = z.enum([
  "proposed",
  "awarded",
  "active",
  "completed",
]);
export type RouteStatus = z.infer<typeof RouteStatus>;

export const BidStatus = z.enum(["submitted", "awarded", "rejected"]);
export type BidStatus = z.infer<typeof BidStatus>;

export const UserRole = z.enum(["shipper", "driver", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const NotificationChannel = z.enum([
  "push",
  "sms",
  "whatsapp",
  "in_app",
]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationStatus = z.enum(["queued", "sent", "failed"]);
export type NotificationStatus = z.infer<typeof NotificationStatus>;

// ============================================================
// Coordinate helpers
// ============================================================

/** Longitude: -180..180 */
const Longitude = z.number().min(-180).max(180);
/** Latitude: -90..90 */
const Latitude = z.number().min(-90).max(90);

export const Coordinate = z.object({
  lat: Latitude,
  lng: Longitude,
});
export type Coordinate = z.infer<typeof Coordinate>;

// ============================================================
// POST /api/v1/shipment/create — Request / Response
// ============================================================

export const CreateShipmentRequest = z.object({
  shipper_id: z.string().uuid(),
  origin: Coordinate,
  origin_address: z.string().min(1),
  destination: Coordinate,
  destination_address: z.string().min(1),
  weight_kg: z.number().positive(),
  volume_cbm: z.number().positive(),
  load_type: z.string().min(1),
  time_window_earliest: z.string().datetime(),
  time_window_latest: z.string().datetime(),
});
export type CreateShipmentRequest = z.infer<typeof CreateShipmentRequest>;

export const CreateShipmentResponse = z.object({
  shipment_id: z.string().uuid(),
  shipper_id: z.string().uuid(),
  origin: Coordinate,
  origin_address: z.string(),
  destination: Coordinate,
  destination_address: z.string(),
  weight_kg: z.number(),
  volume_cbm: z.number(),
  load_type: z.string(),
  time_window_earliest: z.string().datetime(),
  time_window_latest: z.string().datetime(),
  status: ShipmentStatus,
  created_at: z.string().datetime(),
});
export type CreateShipmentResponse = z.infer<typeof CreateShipmentResponse>;

// ============================================================
// POST /api/v1/route/optimize — Request / Response
// ============================================================

export const ShipmentNode = z.object({
  shipment_id: z.string().uuid(),
  pickup: Coordinate,
  dropoff: Coordinate,
  demand_kg: z.number().nonnegative(),
  demand_cbm: z.number().nonnegative(),
  time_window_earliest: z.string().datetime(),
  time_window_latest: z.string().datetime(),
  service_time_minutes: z.number().nonnegative().default(15),
});
export type ShipmentNode = z.infer<typeof ShipmentNode>;

export const VehiclePool = z.object({
  vehicle_id: z.string().uuid(),
  carrier_id: z.string().uuid(),
  capacity_kg: z.number().positive(),
  capacity_cbm: z.number().positive(),
  depot: Coordinate,
  vehicle_type: z.string(),
});
export type VehiclePool = z.infer<typeof VehiclePool>;

export const OptimizeRouteRequest = z.object({
  corridor_id: z.string().uuid(),
  vehicle_pool: z.array(VehiclePool).min(1),
  shipment_nodes: z.array(ShipmentNode).min(1),
  solver_budget_ms: z.number().int().positive().default(500),
});
export type OptimizeRouteRequest = z.infer<typeof OptimizeRouteRequest>;

export const RouteResult = z.object({
  vehicle_id: z.string().uuid(),
  sequence: z.array(z.string().uuid()),
  eta_per_stop: z.array(z.string().datetime()),
  total_cost: z.number().nonnegative(),
});
export type RouteResult = z.infer<typeof RouteResult>;

export const OptimizeRouteResponse = z.object({
  corridor_id: z.string().uuid(),
  routes: z.array(RouteResult),
  unassigned: z.array(z.string().uuid()),
  solver_latency_ms: z.number().int().nonnegative(),
});
export type OptimizeRouteResponse = z.infer<typeof OptimizeRouteResponse>;

// ============================================================
// Bidding
// ============================================================

export const SubmitBidRequest = z.object({
  bid_amount_paise: z.number().int().positive(),
  public_key: z.string().min(1),
  signature: z.string().min(1),
  signed_payload: z.string().min(1),
});
export type SubmitBidRequest = z.infer<typeof SubmitBidRequest>;

export const BidResponse = z.object({
  bid_id: z.string().uuid(),
  route_id: z.string().uuid(),
  carrier_id: z.string().uuid(),
  bid_amount_paise: z.number().int(),
  status: BidStatus,
  submitted_at: z.string().datetime(),
});
export type BidResponse = z.infer<typeof BidResponse>;

// ============================================================
// Telemetry
// ============================================================

export const TelemetryPing = z.object({
  route_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  location: Coordinate,
  recorded_at: z.string().datetime(),
});
export type TelemetryPing = z.infer<typeof TelemetryPing>;

// ============================================================
// Proof of Delivery
// ============================================================

export const ProofOfDeliveryResponse = z.object({
  id: z.string().uuid(),
  shipment_id: z.string().uuid(),
  image_path: z.string(),
  signed_by: z.string(),
  delivered_at: z.string().datetime(),
  certificate_path: z.string().nullable(),
});
export type ProofOfDeliveryResponse = z.infer<typeof ProofOfDeliveryResponse>;
