"""
SmartLogix Gateway — Solver Client (Task 3.8)

Calls the Go solver's internal /route/optimize HTTP endpoint with a
context/timeout matching solver_budget_ms. Handles solver-unavailable
errors by surfacing a clear 503 rather than hanging.
"""

from typing import Any

import httpx
from fastapi import HTTPException, status

from settings import settings


class SolverClient:
    """HTTP client for the Go CVRPTW solver microservice."""

    def __init__(self, base_url: str | None = None):
        self._base_url = base_url or settings.solver_url

    async def optimize(
        self,
        corridor_id: str,
        vehicle_pool: list[dict[str, Any]],
        shipment_nodes: list[dict[str, Any]],
        solver_budget_ms: int = 500,
        request_id: str = "",
    ) -> dict[str, Any]:
        """Call the Go solver's POST /route/optimize endpoint.

        Args:
            corridor_id: The corridor being optimized.
            vehicle_pool: List of available vehicles.
            shipment_nodes: List of shipment nodes to route.
            solver_budget_ms: Time budget for the solver in ms.
            request_id: Correlation ID for logging (Task 3.17).

        Returns:
            Solver response with routes[] and unassigned[].

        Raises:
            HTTPException(503): If the solver is unavailable or times out.
        """
        payload = {
            "corridor_id": corridor_id,
            "vehicle_pool": vehicle_pool,
            "shipment_nodes": shipment_nodes,
            "solver_budget_ms": solver_budget_ms,
        }

        # Timeout slightly longer than the solver budget to account for
        # network overhead, but not so long that the API hangs indefinitely.
        timeout_seconds = (solver_budget_ms + 200) / 1000.0

        headers = {}
        if request_id:
            headers["X-Request-ID"] = request_id

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    f"{self._base_url}/route/optimize",
                    json=payload,
                    headers=headers,
                )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Solver returned {response.status_code}: {response.text}",
                )

            return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Solver timed out — try again or reduce problem size",
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to solver at {self._base_url}",
            )
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Solver communication error: {e}",
            )


# Singleton
solver_client = SolverClient()
