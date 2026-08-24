# SmartLogix — Build Tasks

Read `rules.md` in full before starting. Work through phases in order — later phases assume earlier ones are done. Tick `[x]` and add a one-line completion note under any task you finish, per the Definition of Done in `rules.md` Section 8. If you hit a genuine blocker, log it under `## Deviations Log` at the bottom of this file instead of skipping silently.

Tags: **[PERF]** = needs a passing benchmark/load test. **[RLS]** = needs a Row-Level-Security policy + a test proving unauthorized access is rejected. **[STUB-OK]** = may be delivered as a stubbed implementation per the Missing Credentials Protocol.

---

## Phase 0 — Monorepo & Tooling Setup

- [x] 0.1 Initialize the monorepo at the root with the exact folder layout from `rules.md` Section 4 (`apps/web`, `apps/gateway`, `apps/solver`, `packages/shared-types`, `supabase/`, `infra/`, `docs/`, `.github/workflows/`).
  ✅ Done (implemented in previous session).
- [x] 0.2 Root `README.md`: project one-paragraph summary, architecture diagram (can be an ASCII/Mermaid version of the report's Figure 1), and a "run everything locally" quickstart.
  ✅ Done (implemented in previous session).
- [x] 0.3 `.env.example` at the root listing every env var referenced anywhere in this document, grouped by service, each with a one-line comment.
  ✅ Done (implemented in previous session).
- [x] 0.4 `infra/docker-compose.yml` that brings up: local Supabase (via `supabase start`, or document that Supabase CLI is used instead of compose for this piece), local OSRM (see 0.5), and any other local-only dependency introduced later.
  ✅ Done (implemented in previous session).
- [x] 0.5 OSRM local setup: script in `infra/osrm/` that downloads a Geofabrik OSM extract for a configurable region (default: Delhi/NCR or a small India bounding box to keep the extract small for dev), runs `osrm-extract` → `osrm-partition` → `osrm-customize`, and starts `osrm-routed` on a documented port. Document the equivalent for a full pan-India extract as a comment (larger, for later phases).
  ✅ Done (implemented in previous session).
- [x] 0.6 GitHub Actions skeleton (`.github/workflows/ci.yml`) with three jobs — `web`, `gateway`, `solver` — each currently just checking out and installing dependencies (fleshed out per-service in later phases).
  ✅ Done (implemented in previous session).
- [x] 0.7 Set up `packages/shared-types`: a place for the two canonical API contract schemas (Section on API Contracts below) to live once, generated or hand-synced into both `apps/web` (Zod/TS) and `apps/gateway` (Pydantic) so they can't silently drift.
  ✅ Done (implemented in previous session).

---

## Phase 1 — Supabase Schema & PostGIS Foundations

- [x] 1.1 Create the Supabase project (or confirm the user has — prompt for URL/keys if genuinely missing per rules.md Section 12) and enable the `postgis` extension via a migration (`create extension if not exists postgis;`).
  ✅ Done (implemented in previous session).
- [x] 1.2 Migration: `profiles` table linked 1:1 to `auth.users` (`id uuid references auth.users primary key`), with `role` enum (`shipper`, `driver`, `admin`), `full_name`, `phone`, `preferred_language`. **[RLS]** users can read/update only their own row; admins can read all.
  ✅ Done (implemented in previous session).
- [x] 1.3 Migration: `shippers` table (business name, GSTIN optional, default pickup address) referencing `profiles.id`. **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.4 Migration: `carriers` table (company/individual name, fleet size) referencing `profiles.id`. **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.5 Migration: `vehicles` table — `carrier_id`, `capacity_kg`, `capacity_cbm`, `vehicle_type`, `registration_number`, `current_location geography(Point,4326)` nullable, `is_available boolean`. **[RLS]** carrier can manage only their own vehicles; shippers/other carriers cannot read another carrier's raw location.
  ✅ Done (implemented in previous session).
- [x] 1.6 Migration: `shipments` table matching the `POST /api/v1/shipment/create` contract fields exactly: `shipment_id` (use the row `id`), `shipper_id`, `origin geography(Point,4326)` + `origin_address text`, `destination geography(Point,4326)` + `destination_address text`, `weight_kg numeric`, `volume_cbm numeric`, `load_type text`, `time_window_earliest timestamptz`, `time_window_latest timestamptz`, `status` enum (`pending`, `clustered`, `routed`, `booked`, `in_transit`, `delivered`, `cancelled`), `created_at`. **[RLS]** shipper reads/writes only their own; carriers can read shipments only once attached to a route they're eligible to bid on (join-based policy, not a blanket read).
  ✅ Done (implemented in previous session).
- [x] 1.7 Migration: `corridors` table — `id`, `name`, `bounding_box geography(Polygon,4326)` or a center+radius pair, `active boolean`. Seed 2–3 example corridors (e.g., Delhi–Mumbai trunk) as reference data for the pilot described in the report's Phase 2.
  ✅ Done (implemented in previous session).
- [x] 1.8 Migration: `corridor_memberships` (or a nullable `corridor_id` FK directly on `shipments`/`vehicles`) recording which corridor a shipment/vehicle was clustered into and when.
  ✅ Done (implemented in previous session).
- [x] 1.9 Migration: `routes` table — `id`, `corridor_id`, `vehicle_id`, `sequence jsonb` (ordered node ids), `eta_per_stop jsonb`, `total_cost numeric`, `solver_latency_ms integer`, `status` enum (`proposed`, `awarded`, `active`, `completed`). **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.10 Migration: `bids` table — `id`, `route_id`, `carrier_id`, `bid_amount_paise bigint`, `public_key text` (or FK to a `carrier_keys` table, see 1.11), `signature text`, `signed_payload text` (the exact bytes that were signed, for verification), `status` enum (`submitted`, `awarded`, `rejected`), `submitted_at`. **[RLS]** a carrier can insert their own bid and read only their own bid rows plus the final award outcome, never another carrier's bid amount before award (this directly protects against the "bid-manipulation/collusion" risk in the report).
  ✅ Done (implemented in previous session).
- [x] 1.11 Migration: `carrier_keys` table storing each driver/carrier's registered ECDSA public key (JWK or base64 SPKI), one active key per carrier, with a `created_at` for key-rotation history. **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.12 Migration: `telemetry_pings` table — `id`, `route_id`, `vehicle_id`, `location geography(Point,4326)`, `recorded_at timestamptz`, indexed with a BRIN index on `recorded_at` (see rules.md's TimescaleDB substitution note). **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.13 Migration: `green_credits` table — `id`, `route_id`, `deadhead_km_saved numeric`, `load_factor numeric`, `emission_factor_used numeric`, `co2e_kg_saved numeric`, `computed_at`. **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.14 Migration: `notifications` table — `id`, `profile_id`, `channel` enum (`push`, `sms`, `whatsapp`, `in_app`), `payload jsonb`, `status` enum (`queued`, `sent`, `failed`), `created_at`. **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.15 Migration: `proof_of_delivery` table — `id`, `shipment_id`, `image_path text` (Supabase Storage path), `signed_by`, `delivered_at`, `certificate_path text` (green-mileage certificate PDF path). **[RLS]**
  ✅ Done (implemented in previous session).
- [x] 1.16 Create Supabase Storage buckets: `proof-of-delivery` and `certificates`, both private by default, with signed-URL access only. **[RLS]** (Storage policies, not table RLS, but same rigor.)
  ✅ Done (implemented in previous session).
- [x] 1.17 Write a PostGIS helper SQL function `nearby_shipments_and_vehicles(corridor_bbox geography, buffer_m integer)` used by the clustering step in Phase 4, so the clustering query logic lives in one tested place, not duplicated across FastAPI call sites.
  ✅ Done (implemented in previous session).
- [x] 1.18 Seed script (`supabase/seed.sql` or a Python/TS script) that inserts realistic demo data: a handful of shippers, carriers, vehicles with `current_location` inside a demo corridor, and 10–20 shipments with varied time windows, so every later phase has something to test against without waiting on real users.
  ✅ Done (implemented in previous session).

---

## Phase 2 — Go DVRP Solver Microservice (`apps/solver`)

- [x] 2.1 Scaffold the Go module (`go mod init`), standard layout (`cmd/solver/main.go`, `internal/solver/`, `internal/osrm/`, `internal/api/`).
  ✅ Done (implemented in previous session).
- [x] 2.2 `internal/osrm` client: wraps OSRM's `/table` service to fetch an all-pairs duration+distance matrix for a given set of coordinates, with `context.Context` deadline propagation and a typed error for OSRM unavailability.
  ✅ Done (implemented in previous session).
- [x] 2.3 `internal/solver`: implement the CVRPTW data model — nodes (depot + shipment pickups/drops), vehicles with `Q_k` capacity, demand `d_i`, time windows `[a_i, b_i]`, service time `s_i` — matching the report's Section 1.3 formulation exactly in naming (use these symbols in code comments so the mapping from spec to code is traceable).
  ✅ Done (implemented in previous session).
- [x] 2.4 Implement the **Clarke-Wright savings algorithm** for initial route construction (merge single-shipment routes into multi-stop routes by savings value, respecting vehicle capacity).
  ✅ Done (implemented in previous session).
- [x] 2.5 Implement a **time-boxed local search improvement** pass (2-opt and/or Or-opt moves) that runs until either no improving move is found or the remaining time budget (passed in via context deadline) is exhausted.
  ✅ Done (implemented in previous session).
- [x] 2.6 Implement the objective function exactly as specified: total routed travel cost (Term 1) **plus** a time-window lateness penalty `λ · max(0, T_ik − b_i)` (Term 2) — arrival time is tracked per stop and penalized rather than treated as a hard infeasibility, per the report.
  ✅ Done (implemented in previous session).
- [x] 2.7 Enforce the capacity constraint (`Σ d_i ≤ Q_k` per route) during both construction and every local-search move — a move that would violate capacity is never applied.
  ✅ Done (implemented in previous session).
- [x] 2.8 **[PERF]** Write a benchmark (`go test -bench=BenchmarkSolve`) against a synthetic 150-node instance asserting the full solve (matrix already available) completes with room to spare inside the 500ms budget; wire the actual HTTP handler to use `solver_budget_ms` from the request (defaulting to 500) as the local-search deadline.
  ✅ Done (implemented in previous session).
- [x] 2.9 Implement a graceful degradation path: if the local search hasn't even produced one feasible full assignment by the deadline (pathological instance), fall back to a plain greedy nearest-neighbor assignment so the endpoint never times out with no answer — this satisfies the report's "graceful fallback to greedy heuristic" mitigation for solver latency degradation.
  ✅ Done (implemented in previous session).
- [x] 2.10 HTTP handler implementing `POST /route/optimize` internally (this is what FastAPI calls — see Phase 3.9) accepting `corridor_id`, `vehicle_pool`, `shipment_nodes`, `solver_budget_ms`, and returning `routes[]` (with `vehicle_id`, `sequence`, `eta_per_stop`, `total_cost`) plus `unassigned[]` — field names must match the report's Section 3.3 schema verbatim.
  ✅ Done (implemented in previous session).
- [x] 2.11 Unit tests: capacity violation is rejected, a simple 4-node instance produces the known-optimal route, a shipment outside every vehicle's reachable time window ends up in `unassigned` rather than crashing the solver.
  ✅ Done (implemented in previous session).
- [x] 2.12 Structured logging (request id, corridor id, node count, latency, whether the fallback path was used) for later load-test analysis.
  ✅ Done (implemented in previous session).
- [x] 2.13 Dockerfile for `apps/solver`, multi-stage build, small final image.
  ✅ Done (implemented in previous session).

---

## Phase 3 — FastAPI Orchestration Layer (`apps/gateway`)

- [x] 3.1 Scaffold FastAPI app with the `services/` + `routers/` split described in `rules.md` Section 5; `settings.py` using `pydantic-settings` reading everything from env vars listed in `.env.example`.
  ✅ Done (implemented in previous session).
- [x] 3.2 Supabase JWT auth dependency: verifies incoming bearer tokens against the project's JWT secret/JWKS, injects the authenticated `profile_id` + `role` into request handlers. Every non-public route uses this dependency.
  ✅ Done (implemented in previous session).
- [x] 3.3 Supabase Python client wrapper (`services/db.py`) — a thin, testable layer over `supabase-py`, so route handlers never call `supabase-py` directly.
  ✅ Done (implemented in previous session).
- [x] 3.4 Pydantic schemas mirroring the two contract endpoints from the report's Section 3.3 **exactly** (field names, nesting, types) in `packages/shared-types` (or a Python package imported by `apps/gateway`), plus the extra internal-only fields needed for bidding/telemetry that the report doesn't specify.
  ✅ Done (implemented in previous session).
- [x] 3.5 `POST /api/v1/shipment/create` — validates the shipper is authenticated and matches `shipper_id`, inserts into `shipments`, returns the created row. Reject malformed/absurd coordinates (e.g., outside a sane lat/lng range) with a 422.
  ✅ Done (implemented in previous session).
- [x] 3.6 Corridor clustering service (`services/clustering.py`) calling the PostGIS helper function from Phase 1.17: given a newly created shipment, find nearby pending shipments and available vehicles sharing a plausible corridor, and either attach them to an existing `corridors` row or spin up an ad-hoc corridor cluster.
  ✅ Done (implemented in previous session).
- [x] 3.7 Background trigger: once a corridor cluster reaches a minimum viable size (configurable threshold, e.g. ≥2 shipments or a max-wait timer elapses) it's handed to the route-optimize step automatically — implement via a Supabase scheduled function, a lightweight in-process background task queue, or a polling worker; pick one, document the choice, and make the threshold/timer values env-configurable.
  ✅ Done (implemented in previous session).
- [x] 3.8 `services/solver_client.py` — calls the Go solver's internal `/route/optimize` HTTP endpoint with a context/timeout matching `solver_budget_ms`, handles solver-unavailable errors by surfacing a clear 503 rather than hanging.
  ✅ Done (implemented in previous session).
- [x] 3.9 `POST /api/v1/route/optimize` — the **public-facing** version of the contract: accepts the same shape as the report's schema, internally resolves `shipment_nodes`/`vehicle_pool` from the DB if only ids are given, calls `solver_client`, persists the result into `routes`, and returns it. **[PERF]** integration test asserting the full round trip (DB read → Go solver call → DB write → response) stays inside a documented budget (allow more headroom here than the pure-solver benchmark, since this includes DB and network hops — pick and justify a number, e.g. 800ms p95).
  ✅ Done (implemented in previous session).
- [x] 3.10 `services/bidding.py`: publish a proposed route to eligible carriers (those with an available, capacity-matching vehicle inside the corridor) via a Supabase Realtime broadcast on a per-corridor channel, and queue a push notification (Phase 10) to each eligible driver.
  ✅ Done (implemented in previous session).
- [x] 3.11 `POST /api/v1/route/{route_id}/bid` — accepts `bid_amount_paise`, `public_key` (or a reference to a previously-registered key), `signature`, `signed_payload`. Verifies the signature server-side with `cryptography` (ECDSA P-256/SHA-256) against the carrier's registered public key from `carrier_keys` **before** persisting the bid as valid. Reject with 401 on signature mismatch.
  ✅ Done (implemented in previous session).
- [x] 3.12 `services/awarding.py` + a scheduled/triggered job: once a route's bidding window closes (fixed short window, e.g. 2 minutes, configurable), select the lowest **valid** bid, mark it `awarded`, mark the route `awarded`, mark other bids `rejected`, and notify all bidding carriers of the outcome.
  ✅ Done (implemented in previous session).
- [x] 3.13 `GET /api/v1/shipment/{id}/track` — returns the latest telemetry ping(s) for the shipment's active route; also expose a Supabase Realtime channel name/config so the frontend can subscribe directly for live updates instead of polling.
  ✅ Done (implemented in previous session).
- [x] 3.14 `POST /api/v1/route/{route_id}/telemetry` (driver app → server) — inserts into `telemetry_pings`; triggers the GLEC computation service (Phase 7) incrementally or on trip completion, whichever is simpler to keep inside the latency budget (telemetry ingestion itself should be fire-and-forget fast, not blocked on carbon math).
  ✅ Done (implemented in previous session).
- [x] 3.15 `POST /api/v1/shipment/{id}/proof-of-delivery` — accepts an image upload, stores it via Supabase Storage, marks the shipment `delivered`, and kicks off green-mileage certificate generation (Phase 7.6).
  ✅ Done (implemented in previous session).
- [x] 3.16 Adaptive rerouting: an endpoint/worker that reacts to a `telemetry_pings` gap or an explicit "delay" signal by re-invoking the solver on the affected sub-route with the remaining unvisited nodes and any newly-available backup vehicles nearby (via the same clustering query) — implements the report's "adaptive rerouting" risk mitigation.
  ✅ Done (implemented in previous session).
- [x] 3.17 Centralized error handling returning a consistent JSON error shape; centralized request logging with correlation ids that also appear in the Go solver's logs (pass a request id header through).
  ✅ Done (implemented in previous session).
- [x] 3.18 Dockerfile for `apps/gateway`.
  ✅ Done (implemented in previous session).

---

## Phase 4 — Reverse-Bidding Marketplace (cross-cutting: frontend pieces)

- [x] 4.1 Driver-side key generation flow: on first login, the PWA generates an ECDSA P-256 keypair via `crypto.subtle.generateKey`, stores the private key in IndexedDB (never sent to the server), and registers the public key against the driver's profile via a dedicated endpoint.
  ✅ Done (implemented in previous session).
- [x] 4.2 Driver-side bid signing: constructs the canonical payload to sign (document the exact byte layout — e.g., a stable JSON stringify of `{route_id, bid_amount_paise, carrier_id, timestamp}`), signs it with `crypto.subtle.sign`, and submits alongside the plaintext payload so the server can verify against the same bytes.
  ✅ Done (implemented in previous session).
- [x] 4.3 Bid opportunity UI for drivers: shows the consolidated route summary (stops, distance, time window), a bid input, and a countdown to the bidding window close.
  ✅ Done (implemented in previous session).
- [x] 4.4 Award outcome UI: notifies the driver whether they won, auto-populates the awarded route into "today's manifest" per the report's driver workflow.
  ✅ Done (implemented in previous session).
- [x] 4.5 Anomaly-detection audit log (even a simple heuristic — e.g., flag if the same device fingerprint signs bids for multiple distinct carrier ids in a short window) addressing the report's collusion-risk mitigation; log to a table, don't block on it for MVP.
  ✅ Done (implemented in previous session).

---

## Phase 5 — Frontend PWA Shell (`apps/web`)

- [x] 5.1 Next.js 14 App Router project, TypeScript strict, Tailwind configured, `next-pwa` (or manual service worker) with an installable manifest (icons, theme color, `display: standalone`).
  ✅ Done (implemented in previous session).
- [x] 5.2 Supabase client setup (browser + server components split correctly per Next.js App Router conventions — no service-role key ever shipped to the browser).
  ✅ Done (implemented in previous session).
- [x] 5.3 Auth screens: sign-up/sign-in for shippers (email/password) and drivers (phone + OTP), role-based redirect after login.
  ✅ Done (implemented in previous session).
- [x] 5.4 App shell with role-based navigation: Shipper Portal vs Driver App, sharing the same codebase and design system.
  ✅ Done (implemented in previous session).
- [x] 5.5 MapLibre GL wrapper component: default style from the free MapLibre demo tiles or plain OSM raster tiles (no API key required); if `MAPTILER_API_KEY` is present in env, switch to MapTiler vector tiles instead — implement this as a runtime fallback, not a manual toggle.
  ✅ Done (implemented in previous session).

---

## Phase 6 — Shipper Portal

- [x] 6.1 Shipment creation form: origin/destination (address autocomplete backed by OSRM's `/nearest` or a simple Nominatim lookup — self-hosted or the public Nominatim usage-policy-compliant instance for low volume), weight, volume, load type, delivery time window. Submits to `POST /api/v1/shipment/create`.
  ✅ Done (implemented in previous session).
- [x] 6.2 Route quote screen: once corridor clustering + optimize has run, show the consolidated route on the map, ETA, and total cost, matching the report's shipper workflow step 2.
  ✅ Done (implemented in previous session).
- [x] 6.3 Booking confirmation flow.
  ✅ Done (implemented in previous session).
- [x] 6.4 Live tracking screen: subscribes to the Supabase Realtime channel for the shipment's route and animates the vehicle marker on the MapLibre map as telemetry pings arrive.
  ✅ Done (implemented in previous session).
- [x] 6.5 Proof-of-delivery + green-mileage certificate display/download once a shipment is marked delivered.
  ✅ Done (implemented in previous session).
- [x] 6.6 Shipment history/list view with status badges matching the `shipments.status` enum.
  ✅ Done (implemented in previous session).

---

## Phase 7 — Driver App & Green Telemetry

- [x] 7.1 Capacity declaration screen: driver declares an available vehicle, capacity, and a planned route/corridor intent (matching report's driver workflow step 1).
  ✅ Done (implemented in previous session).
- [x] 7.2 Bid opportunity feed (built in Phase 4.3) wired to real Realtime events.
  ✅ Done (implemented in previous session).
- [x] 7.3 Turn-by-turn multi-stop guidance screen: renders the awarded route's `sequence` and `eta_per_stop` on MapLibre with the current stop highlighted; "confirm delivery at stop" action.
  ✅ Done (implemented in previous session).
- [x] 7.4 Background/foreground geolocation capture (`navigator.geolocation.watchPosition`, respecting battery/permission constraints) posting to `POST /api/v1/route/{route_id}/telemetry` at a sensible interval (e.g., every 15–30s, configurable).
  ✅ Done (implemented in previous session).
- [x] 7.5 `services/glec.py` (gateway-side) implementing the exact GLEC formula from the report: `E = Σ (D_saved × W_freight × EF_diesel)` — `D_saved` computed as the deadhead distance eliminated by consolidation on a leg (compare the consolidated route's actual distance for that leg against the counterfactual empty-return distance it replaces), `W_freight` as the leg's load factor, `EF_diesel` as a configurable constant (env var, defaulting to a documented, cited GLEC diesel emission factor in kg CO₂e per tonne-km). Persist per-trip results into `green_credits`.
  ✅ Done (implemented in previous session).
- [x] 7.6 Green-mileage certificate generator: a simple PDF (e.g., via `reportlab` or `weasyprint` in the gateway) summarizing a completed trip's `co2e_kg_saved`, stored in Supabase Storage's `certificates` bucket, linked from `proof_of_delivery`.
  ✅ Done (implemented in previous session).
- [x] 7.7 Corridor/fleet-level aggregation view (even a simple SQL view or materialized view) summing `green_credits` for ESG-style reporting, exposed via a read-only endpoint for later dashboard use.
  ✅ Done (implemented in previous session).

---

## Phase 8 — Notifications

- [x] 8.1 Web Push: generate VAPID keys locally, implement subscription registration in the PWA (`PushManager.subscribe`), store subscriptions per profile, and a gateway-side send function (`pywebpush` or equivalent).
  ✅ Done (implemented in previous session).
- [x] 8.2 Wire push notifications into: new bid opportunity (driver), bid outcome (driver), route quote ready (shipper), delivery/telemetry milestones (shipper).
  ✅ Done (implemented in previous session).
- [x] 8.3 **[STUB-OK]** `NotificationProvider` interface with an SMS/WhatsApp implementation via Twilio, gated behind `TWILIO_*` env vars being present; if absent, fall back to logging + an in-app `notifications` row only, per the Missing Credentials Protocol.
  ✅ Done (implemented in previous session).
- [x] 8.4 In-app notification center UI (bell icon, list from the `notifications` table via Realtime).
  ✅ Done (implemented in previous session).

---

## Phase 9 — Multilingual & Voice Assistance

- [ ] 9.1 `next-intl` setup with at least English and Hindi locale files covering every user-facing string in the driver app (prioritize the driver app per the report's "mobile-first, multilingual" mitigation; extend to the shipper portal as time allows).
- [ ] 9.2 Language switcher persisted to the driver's `profiles.preferred_language`.
- [ ] 9.3 Voice-assisted prompts for key driver actions (new bid opportunity read aloud via `SpeechSynthesis`, "confirm delivery" nudge) with a feature-detection fallback to silent/text-only on unsupported browsers.
- [ ] 9.4 Voice input for at least one driver action (e.g., "confirm delivery" by voice) via `SpeechRecognition`, again with graceful fallback.

---

## Phase 10 — Testing & Load Testing

- [ ] 10.1 Go: full unit test suite for the solver (construction, local search, capacity/time-window edge cases) plus the Phase 2.8 benchmark, run in CI.
- [ ] 10.2 Python: `pytest` suite for every gateway endpoint, using a test Supabase project or a local Postgres+PostGIS container with the same migrations applied — mock only the Go solver and any third-party network calls (OSRM, Twilio), not the DB.
- [ ] 10.3 Frontend: component tests (Vitest + React Testing Library) for the shipment form, bid form, and map wrapper; Playwright end-to-end test covering the critical path: create shipment → route quote appears → book → (simulate) driver bids → award → (simulate) telemetry → delivered → certificate visible.
- [ ] 10.4 **[PERF]** Load test script (k6 or Locust) hitting `POST /api/v1/route/optimize` at increasing concurrency, producing a p50/p95/p99 latency report; document the result in `docs/` and confirm it meets the budget from `rules.md` Section 3.1, or explicitly log a deviation with the measured number and a remediation plan (e.g., horizontal solver scaling per the report's mitigation table) if it doesn't.
- [ ] 10.5 RLS test pass: for every table tagged **[RLS]** in Phase 1, an automated test confirms an unauthorized read/write is rejected, not just that an authorized one succeeds.

---

## Phase 11 — CI/CD & Deployment

- [ ] 11.1 Flesh out `.github/workflows/ci.yml`: lint + test + build for all three apps on every PR; block merge on failure.
- [ ] 11.2 `supabase/migrations` applied automatically in CI against an ephemeral Postgres to catch migration errors before merge.
- [ ] 11.3 Deployment workflow: `apps/web` → Vercel (connect repo, env vars configured in Vercel dashboard, documented in `docs/`). `apps/gateway` and `apps/solver` → chosen container host, one Dockerfile-based deploy each, documented step by step.
- [ ] 11.4 Production OSRM: document (and, if the agent has infra access, actually provision) a small always-on VM or container running the full India (or chosen-region) OSRM extract, since the local dev extract from Phase 0.5 is intentionally small.
- [ ] 11.5 Supabase production project: run migrations against it, confirm RLS is active (not just present in migration files — actually query as an anon/unauthorized client and confirm rejection).
- [ ] 11.6 Smoke test script run against the deployed environment covering the same critical path as Phase 10.3.

---

## Phase 12 — Documentation & Demo Prep

- [ ] 12.1 `docs/architecture.md`: the real, as-built architecture diagram (update from the placeholder in Phase 0.2), explicitly calling out every adaptation from `rules.md` Section 2 so a judge/reviewer comparing against the original report understands *why* things differ.
- [ ] 12.2 `docs/api-contracts.md`: full OpenAPI-derived documentation of every gateway endpoint (FastAPI gives this almost for free via `/docs` — export it statically too).
- [ ] 12.3 Root `README.md` finished with real setup instructions, not placeholders, verified by literally following them on a clean checkout.
- [ ] 12.4 A short demo script (`docs/demo-script.md`) walking through the shipper → driver → delivery → certificate flow end-to-end, matching the report's two user workflows, suitable for a hackathon judging round.
- [ ] 12.5 `docs/policy-alignment.md`: a short writeup connecting what was actually built to the report's Section 5.2 policy references (NLP, PM GatiShakti, ULIP) — this is presentation material for judges, not code, but is part of "everything in the document being incorporated."

## Review 1 Fixes

### UI Overhaul
- [x] Fix `layout.tsx` — move `themeColor` to `viewport` export, apply Inter font properly
- [x] Install `lucide-react` for premium iconography
- [x] Overhaul `page.tsx` — premium dark landing page with SVG icons, subtle glows, glassmorphism
- [x] Overhaul `shipper/page.tsx` with matching KPI cards, layout consistency, and interactive overlays.
- [x] Overhaul `shipper/layout.tsx` — premium sidebar/nav
- [x] Overhaul `driver/page.tsx` with unified premium dark aesthetic and dynamic components.
- [x] Overhaul `driver/layout.tsx` — premium sidebar/nav
- [x] Review `auth/login/page.tsx` and `auth/signup/page.tsx` for visual alignment with the new aesthetic.

### Backend Typing Fixes
- [x] Identify and fix typing errors in `services/db.py`, utilizing Python's `typing` module to strictly type Supabase responses.
- [x] Address similar static analysis errors in `services/clustering.py` and `routers/shipments.py`.
- [x] Resolve exception handler typing mismatches in `main.py` caused by `slowapi`.
- [x] Verify all 41 Mypy errors are successfully resolved with a local `mypy .` run.
- [x] Add type stubs to dev requirements

---

## Deviations Log

*(Agent: record anything here where you had to depart from a task as written, with the reason and what you did instead. Do not leave a task silently unfinished without an entry here.)*

-
