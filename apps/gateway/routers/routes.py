"""
SmartLogix Gateway — Route Optimization & Bidding Router (Tasks 3.9, 3.11, 3.14)

Endpoints:
  POST /api/v1/route/optimize — Optimize route
  POST /api/v1/route/{route_id}/bid — Submit a bid
  POST /api/v1/route/{route_id}/telemetry — Submit telemetry
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from schemas import (
    BidResponse,
    BidStatus,
    OptimizeRouteRequest,
    OptimizeRouteResponse,
    RouteResult,
    SubmitBidRequest,
    TelemetryPingRequest,
    TelemetryPingResponse,
    Coordinate,
)
from services.auth import AuthenticatedUser, get_current_user, require_driver
from services.bidding import bidding_service, awarding_service
from services.db import db_service
from services.solver_client import solver_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/route", tags=["Routes"])


@router.post("/optimize", response_model=OptimizeRouteResponse)
async def optimize_route(
    body: OptimizeRouteRequest,
    request: Request,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> OptimizeRouteResponse:
    """POST /api/v1/route/optimize (Task 3.9).

    Public-facing route optimization endpoint matching the report's schema.
    Internally calls the Go solver and persists results.
    """
    request_id = request.headers.get("X-Request-ID", "")

    # Convert Pydantic models to dicts for the solver client
    vehicle_pool = [
        {
            "vehicle_id": v.vehicle_id,
            "carrier_id": v.carrier_id,
            "capacity_kg": v.capacity_kg,
            "capacity_cbm": v.capacity_cbm,
            "depot": {"lat": v.depot.lat, "lng": v.depot.lng},
            "vehicle_type": v.vehicle_type,
        }
        for v in body.vehicle_pool
    ]

    shipment_nodes = [
        {
            "shipment_id": s.shipment_id,
            "pickup": {"lat": s.pickup.lat, "lng": s.pickup.lng},
            "dropoff": {"lat": s.dropoff.lat, "lng": s.dropoff.lng},
            "demand_kg": s.demand_kg,
            "demand_cbm": s.demand_cbm,
            "time_window_earliest": s.time_window_earliest.isoformat(),
            "time_window_latest": s.time_window_latest.isoformat(),
            "service_time_minutes": s.service_time_minutes,
        }
        for s in body.shipment_nodes
    ]

    # Call the Go solver
    solver_result = await solver_client.optimize(
        corridor_id=body.corridor_id,
        vehicle_pool=vehicle_pool,
        shipment_nodes=shipment_nodes,
        solver_budget_ms=body.solver_budget_ms,
        request_id=request_id,
    )

    # Persist routes to database
    for route_data in solver_result.get("routes", []):
        await db_service.create_route(
            {
                "corridor_id": body.corridor_id,
                "vehicle_id": route_data.get("vehicle_id"),
                "sequence": route_data.get("sequence", []),
                "eta_per_stop": route_data.get("eta_per_stop", []),
                "total_cost": route_data.get("total_cost", 0),
                "solver_latency_ms": solver_result.get("solver_latency_ms", 0),
                "status": "proposed",
            }
        )

    # Update shipment statuses
    for node in body.shipment_nodes:
        if node.shipment_id not in solver_result.get("unassigned", []):
            await db_service.update_shipment_status(node.shipment_id, "routed")

    # Build response matching the report's schema
    routes = [
        RouteResult(
            vehicle_id=r.get("vehicle_id", ""),
            sequence=r.get("sequence", []),
            eta_per_stop=r.get("eta_per_stop", []),
            total_cost=r.get("total_cost", 0),
        )
        for r in solver_result.get("routes", [])
    ]

    return OptimizeRouteResponse(
        corridor_id=body.corridor_id,
        routes=routes,
        unassigned=solver_result.get("unassigned", []),
        solver_latency_ms=solver_result.get("solver_latency_ms", 0),
    )


@router.post("/{route_id}/bid", response_model=BidResponse)
async def submit_bid(
    route_id: str,
    body: SubmitBidRequest,
    user: Annotated[AuthenticatedUser, Depends(require_driver)],
) -> BidResponse:
    """POST /api/v1/route/{route_id}/bid (Task 3.11).

    Accepts bid with ECDSA signature. Verifies server-side before persisting.
    Rejects with 401 on signature mismatch.
    """
    try:
        bid = await bidding_service.verify_and_submit_bid(
            route_id=route_id,
            carrier_id=user.user_id,
            bid_amount_paise=body.bid_amount_paise,
            public_key_str=body.public_key,
            signature_str=body.signature,
            signed_payload=body.signed_payload,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )

    return BidResponse(
        bid_id=bid["id"],
        route_id=route_id,
        carrier_id=user.user_id,
        bid_amount_paise=bid["bid_amount_paise"],
        status=BidStatus(bid["status"]),
        submitted_at=bid["submitted_at"],
    )


@router.post("/{route_id}/telemetry")
async def submit_telemetry(
    route_id: str,
    body: TelemetryPingRequest,
    user: Annotated[AuthenticatedUser, Depends(require_driver)],
) -> TelemetryPingResponse:
    """POST /api/v1/route/{route_id}/telemetry (Task 3.14).

    Inserts telemetry ping. Fire-and-forget fast — not blocked on carbon math.
    """
    telemetry_data = {
        "route_id": route_id,
        "vehicle_id": body.vehicle_id,
        "location": f"POINT({body.location.lng} {body.location.lat})",
        "recorded_at": body.recorded_at.isoformat(),
    }

    ping = await db_service.insert_telemetry(telemetry_data)

    return TelemetryPingResponse(
        id=ping["id"],
        route_id=route_id,
        vehicle_id=body.vehicle_id,
        location=body.location,
        recorded_at=ping["recorded_at"],
    )


@router.post("/{route_id}/award")
async def award_route(
    route_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
):
    """Manually trigger award processing for a route (Task 3.12)."""
    winner = await awarding_service.process_awards(route_id)
    if not winner:
        raise HTTPException(status_code=404, detail="No valid bids to award")
    return {"awarded_to": winner["carrier_id"], "amount_paise": winner["bid_amount_paise"]}
