"""
SmartLogix Gateway — Pydantic v2 Schemas (Task 3.4)

These schemas mirror the Zod schemas in packages/shared-types/index.ts.
Field names match the report's Section 3.3 contracts EXACTLY.
Extensions are allowed; renames/removals are not (rules.md §3.7).

All money values are integer paise (rules.md §3.2).
All timestamps are ISO-8601 UTC (rules.md §3.3).
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================
# Enums
# ============================================================


class ShipmentStatus(str, Enum):
    pending = "pending"
    clustered = "clustered"
    routed = "routed"
    booked = "booked"
    in_transit = "in_transit"
    delivered = "delivered"
    cancelled = "cancelled"


class RouteStatus(str, Enum):
    proposed = "proposed"
    awarded = "awarded"
    active = "active"
    completed = "completed"


class BidStatus(str, Enum):
    submitted = "submitted"
    awarded = "awarded"
    rejected = "rejected"


class UserRole(str, Enum):
    shipper = "shipper"
    driver = "driver"
    admin = "admin"


class NotificationChannel(str, Enum):
    push = "push"
    sms = "sms"
    whatsapp = "whatsapp"
    in_app = "in_app"


class NotificationStatus(str, Enum):
    queued = "queued"
    sent = "sent"
    failed = "failed"


# ============================================================
# Coordinates
# ============================================================


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


# ============================================================
# POST /api/v1/shipment/create
# ============================================================


class CreateShipmentRequest(BaseModel):
    """Request body for POST /api/v1/shipment/create.

    Field names match the report's Section 3.3 contract exactly.
    """

    shipper_id: str
    origin: Coordinate
    origin_address: str = Field(..., min_length=1)
    destination: Coordinate
    destination_address: str = Field(..., min_length=1)
    weight_kg: float = Field(..., gt=0)
    volume_cbm: float = Field(..., gt=0)
    load_type: str = Field(..., min_length=1)
    time_window_earliest: datetime
    time_window_latest: datetime

    @field_validator("time_window_latest")
    @classmethod
    def validate_time_window(cls, v: datetime, info) -> datetime:
        earliest = info.data.get("time_window_earliest")
        if earliest and v <= earliest:
            raise ValueError("time_window_latest must be after time_window_earliest")
        return v

    @field_validator("origin", "destination")
    @classmethod
    def validate_coordinates(cls, v: Coordinate) -> Coordinate:
        """Reject absurd coordinates outside a sane lat/lng range."""
        if not (-90 <= v.lat <= 90) or not (-180 <= v.lng <= 180):
            raise ValueError(f"Invalid coordinates: lat={v.lat}, lng={v.lng}")
        return v


class CreateShipmentResponse(BaseModel):
    """Response body for POST /api/v1/shipment/create."""

    shipment_id: str
    shipper_id: str
    origin: Coordinate
    origin_address: str
    destination: Coordinate
    destination_address: str
    weight_kg: float
    volume_cbm: float
    load_type: str
    time_window_earliest: datetime
    time_window_latest: datetime
    status: ShipmentStatus
    created_at: datetime


# ============================================================
# POST /api/v1/route/optimize
# ============================================================


class ShipmentNode(BaseModel):
    shipment_id: str
    pickup: Coordinate
    dropoff: Coordinate
    demand_kg: float = Field(..., ge=0)
    demand_cbm: float = Field(..., ge=0)
    time_window_earliest: datetime
    time_window_latest: datetime
    service_time_minutes: float = Field(default=15, ge=0)


class VehiclePool(BaseModel):
    vehicle_id: str
    carrier_id: str
    capacity_kg: float = Field(..., gt=0)
    capacity_cbm: float = Field(..., gt=0)
    depot: Coordinate
    vehicle_type: str


class OptimizeRouteRequest(BaseModel):
    """Request body for POST /api/v1/route/optimize.

    Field names match the report's Section 3.3 contract exactly.
    """

    corridor_id: str
    vehicle_pool: list[VehiclePool] = Field(..., min_length=1)
    shipment_nodes: list[ShipmentNode] = Field(..., min_length=1)
    solver_budget_ms: int = Field(default=500, gt=0)


class RouteResult(BaseModel):
    vehicle_id: str
    sequence: list[str]
    eta_per_stop: list[datetime]
    total_cost: float


class OptimizeRouteResponse(BaseModel):
    """Response body for POST /api/v1/route/optimize."""

    corridor_id: str
    routes: list[RouteResult]
    unassigned: list[str]
    solver_latency_ms: int


# ============================================================
# Bidding
# ============================================================


class SubmitBidRequest(BaseModel):
    """Request body for POST /api/v1/route/{route_id}/bid."""

    bid_amount_paise: int = Field(..., gt=0)  # INR paise, never float (rules.md §3.2)
    public_key: str = Field(..., min_length=1)
    signature: str = Field(..., min_length=1)
    signed_payload: str = Field(..., min_length=1)


class BidResponse(BaseModel):
    bid_id: str
    route_id: str
    carrier_id: str
    bid_amount_paise: int
    status: BidStatus
    submitted_at: datetime


# ============================================================
# Telemetry
# ============================================================


class TelemetryPingRequest(BaseModel):
    """Request body for POST /api/v1/route/{route_id}/telemetry."""

    vehicle_id: str
    location: Coordinate
    recorded_at: datetime


class TelemetryPingResponse(BaseModel):
    id: str
    route_id: str
    vehicle_id: str
    location: Coordinate
    recorded_at: datetime


# ============================================================
# Proof of Delivery
# ============================================================


class ProofOfDeliveryResponse(BaseModel):
    id: str
    shipment_id: str
    image_path: Optional[str] = None
    signed_by: Optional[str] = None
    delivered_at: datetime
    certificate_path: Optional[str] = None


# ============================================================
# Tracking
# ============================================================


class TrackingResponse(BaseModel):
    shipment_id: str
    status: ShipmentStatus
    latest_pings: list[TelemetryPingResponse]
    realtime_channel: Optional[str] = None


# ============================================================
# Error responses (centralized per Task 3.17)
# ============================================================


class ErrorResponse(BaseModel):
    """Consistent JSON error shape for all error responses."""

    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None
