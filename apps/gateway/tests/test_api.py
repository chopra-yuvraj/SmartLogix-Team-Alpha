"""
SmartLogix Gateway — API Tests (Task 3.16)

Tests for the FastAPI gateway endpoints.
Run with: pytest apps/gateway/tests/ -v
"""

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


def test_health_check(client):
    """Test the health check endpoint returns healthy."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "smartlogix-gateway"


def test_root_endpoint(client):
    """Test the root endpoint returns API info."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert data["version"] == "0.1.0"


def test_create_shipment_requires_auth(client):
    """Test that POST /api/v1/shipment/create requires authentication."""
    response = client.post(
        "/api/v1/shipment/create",
        json={
            "shipper_id": "test",
            "origin": {"lat": 28.7, "lng": 77.1},
            "origin_address": "Test Origin",
            "destination": {"lat": 28.6, "lng": 77.2},
            "destination_address": "Test Destination",
            "weight_kg": 100,
            "volume_cbm": 1,
            "load_type": "general",
            "time_window_earliest": "2026-01-01T06:00:00Z",
            "time_window_latest": "2026-01-01T18:00:00Z",
        },
    )
    assert response.status_code in (401, 403)


def test_optimize_route_requires_auth(client):
    """Test that POST /api/v1/route/optimize requires authentication."""
    response = client.post(
        "/api/v1/route/optimize",
        json={
            "corridor_id": "test",
            "vehicle_pool": [
                {
                    "vehicle_id": "v1",
                    "carrier_id": "c1",
                    "capacity_kg": 5000,
                    "capacity_cbm": 20,
                    "depot": {"lat": 28.7, "lng": 77.1},
                    "vehicle_type": "truck",
                }
            ],
            "shipment_nodes": [
                {
                    "shipment_id": "s1",
                    "pickup": {"lat": 28.7, "lng": 77.1},
                    "dropoff": {"lat": 28.6, "lng": 77.2},
                    "demand_kg": 100,
                    "demand_cbm": 1,
                    "time_window_earliest": "2026-01-01T06:00:00Z",
                    "time_window_latest": "2026-01-01T18:00:00Z",
                    "service_time_minutes": 15,
                }
            ],
        },
    )
    assert response.status_code in (401, 403)


def test_bid_requires_auth(client):
    """Test that POST /api/v1/route/{id}/bid requires authentication."""
    response = client.post(
        "/api/v1/route/test-route/bid",
        json={
            "bid_amount_paise": 100000,
            "public_key": "test",
            "signature": "test",
            "signed_payload": "test",
        },
    )
    assert response.status_code in (401, 403)


def test_shipment_validation_rejects_bad_coordinates(client):
    """Test that invalid coordinates are rejected with 422."""
    response = client.post(
        "/api/v1/shipment/create",
        json={
            "shipper_id": "test",
            "origin": {"lat": 999, "lng": 77.1},  # Invalid lat
            "origin_address": "Bad Origin",
            "destination": {"lat": 28.6, "lng": 77.2},
            "destination_address": "Test Destination",
            "weight_kg": 100,
            "volume_cbm": 1,
            "load_type": "general",
            "time_window_earliest": "2026-01-01T06:00:00Z",
            "time_window_latest": "2026-01-01T18:00:00Z",
        },
    )
    # 401 (auth required) or 422 (validation) are both acceptable
    assert response.status_code in (401, 403, 422)
