# SmartLogix — Architecture Document

> **Status:** Living document — updated as the system is built.
> See `rules.md` Section 2 for the authoritative tech stack and adaptation rationale.

## System Overview

SmartLogix is a zero-hardware, cloud-native platform for dynamic freight
consolidation and green routing, built for Smart India Hackathon 2026 (SIH26198).

## Architecture Diagram

```mermaid
graph TB
    subgraph "Clients"
        ShipperPWA["Shipper PWA<br/>(Next.js + MapLibre)"]
        DriverPWA["Driver PWA<br/>(Next.js + MapLibre)"]
    end

    subgraph "API Gateway — FastAPI (Python 3.11+)"
        AuthMiddleware["JWT Auth Middleware"]
        ShipmentAPI["POST /api/v1/shipment/create"]
        RouteAPI["POST /api/v1/route/optimize"]
        BidAPI["POST /api/v1/route/{id}/bid"]
        TelemetryAPI["POST /api/v1/route/{id}/telemetry"]
        
        ClusterSvc["Clustering Service"]
        BidSvc["Bidding Service<br/>(ECDSA verification)"]
        GLECSvc["GLEC Carbon Service"]
        NotifSvc["Notification Service"]
    end

    subgraph "Solver — Go Microservice"
        SolverAPI["POST /route/optimize"]
        ClarkeWright["Clarke-Wright<br/>Construction"]
        LocalSearch["2-opt / Or-opt<br/>Local Search"]
        Fallback["Nearest-Neighbor<br/>Fallback"]
    end

    subgraph "Data Layer — Supabase"
        Postgres["PostgreSQL 15<br/>+ PostGIS"]
        SupaAuth["Supabase Auth<br/>(email + phone OTP)"]
        Realtime["Supabase Realtime<br/>(WebSocket pub/sub)"]
        Storage["Supabase Storage<br/>(PoD images, certificates)"]
    end

    subgraph "Infrastructure"
        OSRM["Self-hosted OSRM<br/>(India OSM extract)"]
    end

    ShipperPWA & DriverPWA --> AuthMiddleware
    AuthMiddleware --> ShipmentAPI & RouteAPI & BidAPI & TelemetryAPI
    
    ShipmentAPI --> ClusterSvc --> Postgres
    RouteAPI --> SolverAPI
    SolverAPI --> ClarkeWright --> LocalSearch --> Fallback
    SolverAPI --> OSRM
    
    BidAPI --> BidSvc --> Postgres
    TelemetryAPI --> GLECSvc --> Postgres
    
    NotifSvc --> Realtime
    DriverPWA & ShipperPWA --> Realtime
    
    AuthMiddleware --> SupaAuth
    Storage --> Postgres
```

## Key Adaptations from Original Report

| Component | Report Says | What We Built | Why |
|-----------|------------|---------------|-----|
| VRP Solver | Go + Google OR-Tools | Go + custom Clarke-Wright + local search | OR-Tools has no Go bindings |
| Database | PostgreSQL + PostGIS | Supabase (managed Postgres + PostGIS) | User-mandated |
| Time-series | TimescaleDB | Plain Postgres + BRIN indexes | Supabase doesn't support TimescaleDB extension |
| Pub/Sub | Redis + raw WebSockets | Supabase Realtime | Avoids extra stateful service |
| Maps | Leaflet + MapLibre | MapLibre only | Covers both raster and vector |

## Data Flow

1. **Shipper creates shipment** → Gateway validates → PostGIS clustering
2. **Cluster reaches threshold** → Gateway calls Go solver → Routes proposed
3. **Routes published to drivers** → Supabase Realtime broadcast
4. **Driver bids** → ECDSA signature verified → Bid persisted
5. **Bidding window closes** → Lowest valid bid awarded → Notifications sent
6. **Driver starts route** → Telemetry pings → Live tracking for shipper
7. **Delivery completed** → PoD uploaded → GLEC carbon savings computed → Certificate generated

## Security Architecture

- JWT auth on every protected endpoint (Supabase-issued tokens)
- Row-Level Security on every database table
- ECDSA P-256 bid signing (Web Crypto API client-side, `cryptography` server-side)
- Rate limiting on public endpoints (slowapi)
- No secrets in committed code
