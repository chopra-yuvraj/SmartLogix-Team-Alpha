"""
SmartLogix Gateway — GLEC Carbon Savings Service (Task 7.5)

Implements the exact GLEC formula from the report:
  E = Σ (D_saved × W_freight × EF_diesel)

Where:
  - D_saved: deadhead distance eliminated by consolidation on a leg
    (consolidated route distance vs counterfactual empty-return distance)
  - W_freight: the leg's load factor (tonnes)
  - EF_diesel: configurable constant (env var GLEC_EF_DIESEL,
    default 0.062 kg CO₂e per tonne-km, GLEC Framework v3.0)
"""

import logging
from typing import Any

from services.db import DBService, db_service
from settings import settings

logger = logging.getLogger(__name__)


class GLECService:
    """Computes Scope-3 carbon savings against the GLEC framework."""

    def __init__(self, db: DBService | None = None):
        self._db = db or db_service
        self._ef_diesel = settings.glec_ef_diesel

    async def compute_green_credits(
        self,
        route_id: str,
        actual_distance_km: float,
        counterfactual_distance_km: float,
        total_freight_tonnes: float,
    ) -> dict[str, Any]:
        """Compute and persist carbon savings for a completed route.

        Args:
            route_id: The completed route.
            actual_distance_km: Total distance driven on the consolidated route.
            counterfactual_distance_km: Sum of individual point-to-point distances
                if each shipment were transported separately (with empty returns).
            total_freight_tonnes: Total weight transported in tonnes.

        Returns:
            The green_credits record.
        """
        # D_saved = counterfactual - actual (km saved by consolidation)
        deadhead_km_saved = max(0, counterfactual_distance_km - actual_distance_km)

        # Load factor = actual freight / vehicle capacity (simplified)
        load_factor = total_freight_tonnes if total_freight_tonnes > 0 else 0

        # E = D_saved × W_freight × EF_diesel
        co2e_kg_saved = deadhead_km_saved * load_factor * self._ef_diesel

        credit_data = {
            "route_id": route_id,
            "deadhead_km_saved": round(deadhead_km_saved, 2),
            "load_factor": round(load_factor, 4),
            "emission_factor_used": self._ef_diesel,
            "co2e_kg_saved": round(co2e_kg_saved, 4),
        }

        credit = await self._db.insert_green_credit(credit_data)

        logger.info(
            f"Green credits computed for route {route_id}: "
            f"saved {deadhead_km_saved:.1f} km, "
            f"{co2e_kg_saved:.2f} kg CO₂e"
        )

        return credit


glec_service = GLECService()
