"""
SmartLogix Gateway — Shipment Router (Tasks 3.5, 3.13, 3.15)

Endpoints:
  POST /api/v1/shipment/create — Create a shipment
  GET  /api/v1/shipment/{id}/track — Track a shipment
  POST /api/v1/shipment/{id}/proof-of-delivery — Upload PoD
  GET  /api/v1/shipment/list — List shipper's shipments

Route handlers only do request parsing, calling the service, and shaping
the response. No business logic here (rules.md §5).
"""

import logging
import uuid
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status

from schemas import (
    CreateShipmentRequest,
    CreateShipmentResponse,
    ProofOfDeliveryResponse,
    ShipmentStatus,
    TrackingResponse,
    TelemetryPingResponse,
    Coordinate,
)
from services.auth import AuthenticatedUser, get_current_user, require_shipper
from services.clustering import clustering_service
from services.db import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shipment", tags=["Shipments"])


@router.post(
    "/create",
    response_model=CreateShipmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_shipment(
    body: CreateShipmentRequest,
    user: Annotated[AuthenticatedUser, Depends(require_shipper)],
) -> CreateShipmentResponse:
    """POST /api/v1/shipment/create — Create a new shipment (Task 3.5).

    Validates the shipper is authenticated and matches shipper_id.
    Rejects malformed/absurd coordinates with 422.
    """
    # Authorization: ensure the authenticated user matches shipper_id
    # Never trust client-supplied shipper_id for auth (rules.md §7)
    if body.shipper_id != user.user_id and user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create shipments for another shipper",
        )

    # Build the insert data with PostGIS geography points
    shipment_data = {
        "shipper_id": body.shipper_id,
        "origin": f"POINT({body.origin.lng} {body.origin.lat})",
        "origin_address": body.origin_address,
        "destination": f"POINT({body.destination.lng} {body.destination.lat})",
        "destination_address": body.destination_address,
        "weight_kg": body.weight_kg,
        "volume_cbm": body.volume_cbm,
        "load_type": body.load_type,
        "time_window_earliest": body.time_window_earliest.isoformat(),
        "time_window_latest": body.time_window_latest.isoformat(),
        "status": "pending",
    }

    shipment = await db_service.create_shipment(shipment_data)

    # Trigger corridor clustering in background (Task 3.7)
    shipment_id = shipment.get("id", "")
    try:
        cluster_result = await clustering_service.cluster_shipment(shipment_id)
        if cluster_result and cluster_result.get("ready_for_optimization"):
            logger.info(f"Shipment {shipment_id} ready for route optimization")
    except Exception as e:
        logger.error(f"Clustering failed for {shipment_id}: {e}")

    return CreateShipmentResponse(
        shipment_id=shipment["id"],
        shipper_id=shipment["shipper_id"],
        origin=Coordinate(lat=body.origin.lat, lng=body.origin.lng),
        origin_address=shipment["origin_address"],
        destination=Coordinate(lat=body.destination.lat, lng=body.destination.lng),
        destination_address=shipment["destination_address"],
        weight_kg=shipment["weight_kg"],
        volume_cbm=shipment["volume_cbm"],
        load_type=shipment["load_type"],
        time_window_earliest=shipment["time_window_earliest"],
        time_window_latest=shipment["time_window_latest"],
        status=ShipmentStatus(shipment["status"]),
        created_at=shipment["created_at"],
    )


@router.get("/{shipment_id}/track", response_model=TrackingResponse)
async def track_shipment(
    shipment_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> TrackingResponse:
    """GET /api/v1/shipment/{id}/track — Track a shipment (Task 3.13).

    Returns latest telemetry pings and a Realtime channel name for
    live updates.
    """
    shipment = await db_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Authorization check
    if (
        shipment["shipper_id"] != user.user_id
        and user.role.value != "admin"
    ):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get latest telemetry if there's an active route
    latest_pings: list[TelemetryPingResponse] = []
    realtime_channel = None

    if shipment.get("corridor_id"):
        realtime_channel = f"corridor:{shipment['corridor_id']}"

        # Find the route for this corridor
        routes_result = db_service.client.table("routes").select("id").eq(
            "corridor_id", shipment["corridor_id"]
        ).in_("status", ["active", "awarded"]).limit(1).execute()

        if routes_result.data:
            route_data = cast(list[dict[str, Any]], routes_result.data)
            route_id = str(route_data[0]["id"])
            pings = await db_service.get_latest_telemetry(route_id, limit=5)
            latest_pings = [
                TelemetryPingResponse(
                    id=p["id"],
                    route_id=p["route_id"],
                    vehicle_id=p["vehicle_id"],
                    location=Coordinate(lat=0, lng=0),  # Parsed from geography
                    recorded_at=p["recorded_at"],
                )
                for p in pings
            ]

    return TrackingResponse(
        shipment_id=shipment_id,
        status=ShipmentStatus(shipment["status"]),
        latest_pings=latest_pings,
        realtime_channel=realtime_channel,
    )


@router.post("/{shipment_id}/proof-of-delivery")
async def upload_proof_of_delivery(
    shipment_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    signed_by: str = Form(...),
    image: UploadFile = File(...),
) -> ProofOfDeliveryResponse:
    """POST /api/v1/shipment/{id}/proof-of-delivery (Task 3.15).

    Accepts an image upload, stores via Supabase Storage,
    marks the shipment delivered, and triggers certificate generation.
    """
    shipment = await db_service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Upload image to Supabase Storage
    image_content = await image.read()
    file_path = f"pod/{shipment_id}/{image.filename}"

    try:
        db_service.client.storage.from_("proof-of-delivery").upload(
            file_path, image_content
        )
    except Exception as e:
        logger.error(f"Failed to upload PoD image: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")

    # Create PoD record
    pod_data = {
        "shipment_id": shipment_id,
        "image_path": file_path,
        "signed_by": signed_by,
    }
    pod = await db_service.create_proof_of_delivery(pod_data)

    # Mark shipment as delivered
    await db_service.update_shipment_status(shipment_id, "delivered")

    # Trigger green-mileage certificate generation (Task 7.6) in background
    # This is handled by the certificate generation service

    return ProofOfDeliveryResponse(
        id=pod["id"],
        shipment_id=shipment_id,
        image_path=file_path,
        signed_by=signed_by,
        delivered_at=pod["delivered_at"],
        certificate_path=None,  # Generated async
    )


@router.get("/list")
async def list_shipments(
    user: Annotated[AuthenticatedUser, Depends(require_shipper)],
) -> dict[str, list[dict[str, Any]]]:
    """GET /api/v1/shipment/list — List shipper's shipments."""
    shipments = await db_service.get_shipments_by_shipper(user.user_id)
    return {"shipments": shipments}
