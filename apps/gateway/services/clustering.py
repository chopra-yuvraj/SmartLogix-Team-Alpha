"""
SmartLogix Gateway — Corridor Clustering Service (Task 3.6)

Given a newly created shipment, finds nearby pending shipments and
available vehicles sharing a plausible corridor using the PostGIS
helper function from Phase 1.17.
"""

import logging
from typing import Any, cast

from services.db import DBService, db_service
from settings import settings

logger = logging.getLogger(__name__)


class ClusteringService:
    """Clusters shipments and vehicles into corridor groups."""

    def __init__(self, db: DBService | None = None):
        self._db = db or db_service

    async def cluster_shipment(self, shipment_id: str) -> dict[str, Any] | None:
        """Try to cluster a new shipment into a corridor.

        Steps:
        1. Look up the shipment
        2. Find which corridor(s) the origin falls within
        3. Use the PostGIS helper to find nearby pending shipments + vehicles
        4. If the cluster meets minimum size, return the cluster info

        Returns:
            Corridor cluster info if minimum size met, None otherwise.
        """
        shipment = await self._db.get_shipment(shipment_id)
        if not shipment:
            logger.error(f"Shipment {shipment_id} not found")
            return None

        # Check if already clustered
        if shipment.get("corridor_id"):
            logger.info(f"Shipment {shipment_id} already in corridor {shipment['corridor_id']}")
            return {"corridor_id": shipment["corridor_id"]}

        # Use RPC to call the PostGIS helper function
        try:
            corridors = await self._db.get_corridors(active_only=True)

            for corridor in corridors:
                corridor_id = corridor["id"]

                # Call the nearby_shipments_and_vehicles function via RPC
                result = self._db.client.rpc(
                    "nearby_shipments_and_vehicles",
                    {
                        "corridor_bbox": corridor.get("bounding_box", ""),
                        "buffer_m": 50000,  # 50km
                    },
                ).execute()

                entities = cast(list[dict[str, Any]], result.data) if result.data else []

                # Count pending shipments and available vehicles
                pending_shipments = [
                    e for e in entities if e["entity_type"] == "shipment"
                ]
                available_vehicles = [
                    e for e in entities if e["entity_type"] == "vehicle"
                ]

                # Check if minimum cluster size is met
                if (
                    len(pending_shipments) >= settings.cluster_min_shipments
                    and len(available_vehicles) >= 1
                ):
                    # Assign shipment to this corridor
                    await self._db.update_shipment_status(shipment_id, "clustered")
                    self._db.client.table("shipments").update(
                        {"corridor_id": corridor_id, "status": "clustered"}
                    ).eq("id", shipment_id).execute()

                    logger.info(
                        f"Shipment {shipment_id} clustered into corridor {corridor_id} "
                        f"({len(pending_shipments)} shipments, {len(available_vehicles)} vehicles)"
                    )

                    return {
                        "corridor_id": corridor_id,
                        "shipment_count": len(pending_shipments),
                        "vehicle_count": len(available_vehicles),
                        "ready_for_optimization": True,
                    }

        except Exception as e:
            logger.error(f"Clustering error for shipment {shipment_id}: {e}")

        return None


clustering_service = ClusteringService()
