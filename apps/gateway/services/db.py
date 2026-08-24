"""
SmartLogix Gateway — Supabase DB Client Wrapper (Task 3.3)

Thin, testable layer over supabase-py so route handlers never
call supabase-py directly. All DB access goes through this module.
"""

from typing import Any, cast

from supabase import create_client, Client

from settings import settings


def get_supabase_client() -> Client:
    """Create a Supabase client with the service role key (server-side)."""
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def get_anon_client() -> Client:
    """Create a Supabase client with the anon key (for RLS-respecting queries)."""
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
    )


class DBService:
    """Wrapper around Supabase client for database operations."""

    def __init__(self, client: Client | None = None):
        self._client = client or get_supabase_client()

    @property
    def client(self) -> Client:
        return self._client

    # ---- Shipments ----

    async def create_shipment(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a new shipment and return the created row."""
        result = self._client.table("shipments").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    async def get_shipment(self, shipment_id: str) -> dict[str, Any] | None:
        """Get a shipment by ID."""
        result = (
            self._client.table("shipments")
            .select("*")
            .eq("id", shipment_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    async def get_shipments_by_shipper(self, shipper_id: str) -> list[dict[str, Any]]:
        """Get all shipments for a shipper."""
        result = (
            self._client.table("shipments")
            .select("*")
            .eq("shipper_id", shipper_id)
            .order("created_at", desc=True)
            .execute()
        )
        return cast(list[dict[str, Any]], result.data) if result.data else []

    async def update_shipment_status(
        self, shipment_id: str, status: str
    ) -> dict[str, Any] | None:
        """Update a shipment's status."""
        result = (
            self._client.table("shipments")
            .update({"status": status})
            .eq("id", shipment_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    # ---- Corridors ----

    async def get_corridors(self, active_only: bool = True) -> list[dict[str, Any]]:
        """Get all corridors."""
        query = self._client.table("corridors").select("*")
        if active_only:
            query = query.eq("active", True)
        result = query.execute()
        return cast(list[dict[str, Any]], result.data) if result.data else []

    async def get_corridor(self, corridor_id: str) -> dict[str, Any] | None:
        """Get a corridor by ID."""
        result = (
            self._client.table("corridors")
            .select("*")
            .eq("id", corridor_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    # ---- Routes ----

    async def create_route(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a new route."""
        result = self._client.table("routes").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    async def get_route(self, route_id: str) -> dict[str, Any] | None:
        """Get a route by ID."""
        result = (
            self._client.table("routes")
            .select("*")
            .eq("id", route_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    async def update_route(
        self, route_id: str, data: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Update a route."""
        result = (
            self._client.table("routes")
            .update(data)
            .eq("id", route_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    # ---- Bids ----

    async def create_bid(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a new bid."""
        result = self._client.table("bids").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    async def get_bids_for_route(self, route_id: str) -> list[dict[str, Any]]:
        """Get all bids for a route."""
        result = (
            self._client.table("bids")
            .select("*")
            .eq("route_id", route_id)
            .order("bid_amount_paise", desc=False)
            .execute()
        )
        return cast(list[dict[str, Any]], result.data) if result.data else []

    async def update_bid_status(
        self, bid_id: str, status: str
    ) -> dict[str, Any] | None:
        """Update a bid's status."""
        result = (
            self._client.table("bids")
            .update({"status": status})
            .eq("id", bid_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    # ---- Carrier Keys ----

    async def get_active_carrier_key(self, carrier_id: str) -> dict[str, Any] | None:
        """Get the active public key for a carrier."""
        result = (
            self._client.table("carrier_keys")
            .select("*")
            .eq("carrier_id", carrier_id)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None

    # ---- Vehicles ----

    async def get_available_vehicles(
        self, carrier_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get available vehicles, optionally filtered by carrier."""
        query = (
            self._client.table("vehicles")
            .select("*")
            .eq("is_available", True)
        )
        if carrier_id:
            query = query.eq("carrier_id", carrier_id)
        result = query.execute()
        return cast(list[dict[str, Any]], result.data) if result.data else []

    # ---- Telemetry ----

    async def insert_telemetry(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a telemetry ping."""
        result = self._client.table("telemetry_pings").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    async def get_latest_telemetry(
        self, route_id: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """Get latest telemetry pings for a route."""
        result = (
            self._client.table("telemetry_pings")
            .select("*")
            .eq("route_id", route_id)
            .order("recorded_at", desc=True)
            .limit(limit)
            .execute()
        )
        return cast(list[dict[str, Any]], result.data) if result.data else []

    # ---- Green Credits ----

    async def insert_green_credit(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a green credit record."""
        result = self._client.table("green_credits").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    # ---- Notifications ----

    async def insert_notification(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert a notification."""
        result = self._client.table("notifications").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    async def get_notifications(
        self, profile_id: str, limit: int = 50
    ) -> list[dict[str, Any]]:
        """Get notifications for a user."""
        result = (
            self._client.table("notifications")
            .select("*")
            .eq("profile_id", profile_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return cast(list[dict[str, Any]], result.data) if result.data else []

    # ---- Proof of Delivery ----

    async def create_proof_of_delivery(
        self, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Insert a proof of delivery record."""
        result = self._client.table("proof_of_delivery").insert(data).execute()
        return cast(dict[str, Any], result.data[0]) if result.data else {}

    # ---- Profiles ----

    async def get_profile(self, profile_id: str) -> dict[str, Any] | None:
        """Get a user profile."""
        result = (
            self._client.table("profiles")
            .select("*")
            .eq("id", profile_id)
            .execute()
        )
        return cast(dict[str, Any], result.data[0]) if result.data else None


# Singleton for dependency injection
db_service = DBService()
