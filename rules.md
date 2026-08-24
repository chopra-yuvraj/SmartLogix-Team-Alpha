# SmartLogix — Agent Rules & Engineering Constitution

**Read this file in full before touching `tasks.md`.** These rules govern *how* every task is implemented. If anything in `tasks.md` ever conflicts with this file, `rules.md` wins. If a rule conflicts with reality (a library doesn't exist, an API behaves differently), stop, note the conflict at the top of `tasks.md` under a `## Deviations Log` section you create, pick the closest reasonable alternative, and keep going — never silently ignore a requirement.

---

## 1. Project Identity

- **Name:** SmartLogix — Dynamic Freight Consolidation & Green Routing Engine
- **Origin:** Smart India Hackathon 2026, Problem Statement SIH26198 (AICTE Student Innovation), Theme: Transportation & Logistics — Software Only
- **Mission:** A zero-hardware, cloud-native platform that consolidates India's fragmented Less-Than-Truckload (LTL) freight into algorithmically routed, multi-stop loads; settles carrier assignment via reverse-bidding; and quantifies Scope-3 carbon savings against the GLEC framework.
- **Primary users:** MSME shippers (web/PWA), commercial truck drivers/carriers (mobile-first PWA), and (read-only, later phase) logistics planners/regulators.
- **The single most important non-functional requirement:** the route-optimization request/response cycle must stay inside a **sub-500ms p95 latency budget** end-to-end from the orchestration API's perspective. Every architectural choice below is downstream of this constraint.

---

## 2. Authoritative Tech Stack

This is the tech stack the agent must use. Where it differs from the literal wording of the source project report, the difference and the reason are documented — **do not "correct" these back to the report's wording**, the adaptations exist because the literal stack is not buildable or not appropriate for the chosen database.

| Layer | Technology | Adaptation from original spec & why |
|---|---|---|
| Frontend | Next.js 14+ (App Router), React 19, TypeScript, Tailwind CSS | None — matches spec |
| Maps | MapLibre GL JS | None — matches spec (Leaflet dropped in favor of MapLibre alone, since MapLibre already covers both raster and vector use cases and avoids shipping two mapping libraries) |
| PWA | `next-pwa` (or hand-rolled service worker if `next-pwa` proves incompatible with the Next.js version in use) | Implementation detail, not in spec |
| Core Routing Engine | Go microservice | **Adapted algorithm.** The source report pairs "Go" with "Google OR-Tools." OR-Tools has **no official Go bindings** (only C++, Python, Java, .NET). Rather than forcing OR-Tools into Go via fragile cgo bindings, the Go service implements its **own CVRPTW metaheuristic**: Clarke-Wright savings algorithm for initial route construction, followed by time-boxed 2-opt / Or-opt local search improvement, with capacity and time-window feasibility checked at every insertion. This is a standard, well-documented approach to CVRPTW and is what most production VRP engines actually do under a hard latency budget — it also makes the explicit MTZ subtour-elimination constraint from the report unnecessary, because a savings-based construction heuristic never produces disconnected subtours in the first place (routes are built additively from single-node routes, they can't disconnect from the depot). Document this substitution again in the code comments of the solver package. |
| Orchestration | FastAPI (Python 3.11+) | None — matches spec |
| Distance/Time Matrix | Self-hosted OSRM (Docker, `osrm-backend`, India OSM extract from Geofabrik) | Spec says "OpenStreetMap + OSRM" — this is literally what self-hosting OSRM is. Do **not** call the public `router.project-osrm.org` demo server for anything except a local smoke test; it is rate-limited, has no SLA, and is explicitly barred from production use by its own usage policy. |
| Database | **Supabase** (managed Postgres) with the `postgis` extension enabled | User-mandated. Replaces the report's standalone PostgreSQL+PostGIS. |
| Time-series telemetry | Plain Postgres tables in Supabase, with a `created_at`/`recorded_at` column, BRIN index, and monthly partitioning if volume warrants it | Spec says TimescaleDB. **Hosted Supabase does not support the `timescaledb` extension.** This is a hard platform constraint, not a choice — plain indexed/partitioned tables are the correct substitute at hackathon/MVP scale. If the person ever migrates to self-hosted Supabase (Docker), TimescaleDB can be re-introduced; leave a comment noting this. |
| Pub/sub & live sync | **Supabase Realtime** (Postgres changefeed broadcast + Presence + Broadcast channels) | Spec says Redis pub/sub + raw WebSockets. Supabase Realtime is a WebSocket transport backed by Postgres logical replication — it satisfies the "live GPS/WebSocket position data" and "reassigns nearby backup carriers via pub/sub" requirements without adding a second stateful service to operate. Do not stand up a separate Redis unless a later task explicitly calls for a cache (see Upstash note below). |
| Optional cache | Upstash Redis (serverless, REST-based) | Only introduce this in Phase 12+ if load testing shows the corridor-clustering query needs a cache in front of it. Not required for MVP. Third-party account required — see Section 12. |
| Auth | Supabase Auth (email/password + phone OTP) | Phone OTP specifically supports the "drivers resistant to app literacy" risk mitigation — a driver can log in with just a phone number and OTP, no password to remember. |
| Storage | Supabase Storage | Proof-of-delivery images and green-mileage certificate PDFs. |
| Bid signing | Web Crypto API, ECDSA P-256 + SHA-256, generated and used client-side; verified server-side with Python's `cryptography` package | Matches spec's "Web Crypto API-secured bidding interface." `cryptography`'s `ec.ECDSA(hashes.SHA256())` over the P-256 curve is byte-compatible with what `crypto.subtle.sign({name: "ECDSA", hash: "SHA-256"}, ...)` produces, so signatures created in the browser verify correctly in FastAPI. |
| Push notifications | Web Push API (VAPID) | Free, no third-party account, works across the PWA on Android/desktop. iOS Safari support for Web Push is partial — see Section 12. |
| SMS / WhatsApp | Twilio, behind a `NotificationProvider` interface, **stubbed by default** | Third-party account required. See Section 12 — do not block other tasks on this. |
| i18n | `next-intl` | For the multilingual driver PWA requirement. |
| Voice assistance | Web Speech API (`SpeechSynthesis` + `SpeechRecognition`, native browser APIs) | Free, no third party. Note in the UI when the driver's browser doesn't support `SpeechRecognition` (notably Firefox) and fall back to text-only. |
| CI/CD | GitHub Actions | Lint + test + build per service on every PR. |
| Deployment | Frontend → Vercel. Go solver + FastAPI gateway → any container host (Fly.io, Render, or Railway — pick one and be consistent). Supabase → managed. | |

---

## 3. Non-Negotiable Constraints

1. **Sub-500ms p95** for `POST /api/v1/route/optimize` against a corridor cluster of up to 150 nodes (shipments + vehicles combined). This is measured and asserted in a benchmark test, not just claimed.
2. All money values are INR, stored as integer paise (never floats) in the database; formatted as ₹ only at the presentation layer.
3. All timestamps are stored and transmitted as ISO-8601 UTC. Convert to IST (`Asia/Kolkata`) only in UI rendering.
4. **Row-Level Security (RLS) must be enabled on every Supabase table before that table is considered done.** A table with RLS disabled, or with a blanket `USING (true)` policy on a write operation, is not an acceptable finished state — call this out explicitly if a task seems to need it.
5. No secret ever appears in committed code. Every secret has a name in `.env.example` with a one-line comment on where to obtain it, and the actual value lives only in an untracked `.env`.
6. Every request/response body crossing a service boundary is validated against an explicit schema — Pydantic in Python, a Go struct with validation tags in Go, Zod in TypeScript. No untyped `dict`/`any` payloads on the wire.
7. The two API contracts given in the source report (`POST /api/v1/shipment/create`, `POST /api/v1/route/optimize`) must be implemented with those exact paths and those exact field names. Extend them (add fields) if a task requires it, but never rename or drop a field the report specifies.

---

## 4. Monorepo Structure

```
smartlogix/
├── apps/
│   ├── web/                    # Next.js PWA — shipper + driver surfaces
│   ├── gateway/                 # FastAPI orchestration service
│   └── solver/                  # Go DVRP microservice
├── packages/
│   └── shared-types/            # OpenAPI-generated / hand-written shared types
├── supabase/
│   ├── migrations/              # numbered SQL migration files, never hand-edited in dashboard
│   └── config.toml
├── infra/
│   ├── docker-compose.yml       # local OSRM, local dev orchestration
│   └── osrm/                    # OSRM data prep scripts
├── docs/
│   ├── architecture.md
│   └── api-contracts.md
├── .github/workflows/
├── .env.example
└── tasks.md / rules.md
```

Do not deviate from this layout without recording why in the Deviations Log.

---

## 5. Coding Standards

**TypeScript / React (`apps/web`)**
- Strict mode on (`"strict": true` in `tsconfig.json`). No `any` — use `unknown` and narrow.
- One component per file, function components + hooks only, no class components.
- Styling via Tailwind utility classes; no inline `style={{}}` except for values computed at runtime (e.g., map marker positions).
- Absolute imports via a `@/` alias, no `../../../` chains.
- ESLint + Prettier enforced in CI; a PR that fails lint is not done.

**Python (`apps/gateway`)**
- Python 3.11+, fully type-hinted, `async def` for all I/O-bound endpoints.
- Pydantic v2 models for every request/response body.
- Formatting/linting via `ruff` + `black`, both enforced in CI.
- No business logic inside route handlers — handlers call a `services/` layer; route handlers only do request parsing, calling the service, and shaping the response.

**Go (`apps/solver`)**
- `gofmt`/`goimports` clean, standard project layout (`cmd/`, `internal/`).
- Every exported function that does I/O takes a `context.Context` as its first argument and respects cancellation/deadline (this is how the 500ms budget is actually enforced — the context deadline, not a manual timer).
- No global mutable state; dependencies passed explicitly.
- Table-driven tests for the solver package; a benchmark (`go test -bench`) that asserts the latency budget on a synthetic 150-node instance.

---

## 6. Database & Migration Rules

- Every schema change is a new numbered file under `supabase/migrations/` (`supabase migration new <name>`), applied via the Supabase CLI. **Never** hand-edit schema through the Supabase dashboard and call a task done — the migration file is the source of truth.
- Geographic columns use `geography(Point, 4326)` (PostGIS), not two separate `lat`/`lng` floats, so `ST_DWithin`/`ST_ClusterDBSCAN` work directly. Store `lat`/`lng` as *generated columns* off the geography column only if the frontend needs them raw.
- Table names: `snake_case`, plural (`shipments`, `vehicles`, `bids`).
- Every table gets: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, and, where mutable, `updated_at timestamptz`.
- RLS policy required per table per operation (`select`/`insert`/`update`/`delete`) before the table's task is marked done — see Section 3.4.

---

## 7. Security Rules

- Every protected FastAPI endpoint verifies the Supabase-issued JWT (via Supabase's JWKS or shared secret, whichever the deployed Supabase project uses) and derives the caller's role/id from it — never trust a client-supplied `shipper_id`/`driver_id` in the body for authorization decisions, only for data content.
- A bid is never awarded without server-side ECDSA signature verification against the driver's registered public key. A missing or invalid signature is a hard rejection, not a warning.
- Rate-limit public, unauthenticated endpoints (e.g. `slowapi` in FastAPI).
- Sanitize and bound all geospatial query inputs (reject absurd bounding boxes, cap radius/results) so a malformed or malicious clustering query can't force a full-table spatial scan.

---

## 8. Testing & Definition of Done

A task in `tasks.md` is not complete until **all** of the following are true:
1. The code exists and runs locally per the setup instructions in `docs/`.
2. It has automated tests (unit at minimum; integration where the task spans services) that pass in CI.
3. Lint/format checks pass.
4. Any task tagged **[PERF]** in `tasks.md` has a passing benchmark/load test asserting its stated latency number.
5. Any task tagged **[RLS]** has a policy file/migration and a test proving an unauthorized read/write is actually rejected (not just that an authorized one succeeds).
6. The relevant checkbox in `tasks.md` is ticked and a one-line completion note is added directly under it.

---

## 9. Missing Credentials Protocol

Some third-party services need an account the agent cannot create on the user's behalf. When a task depends on one of these (see Section 12 for the full list), the agent must **not** stop and wait. Instead:

1. Build the feature against a clean interface/abstraction (e.g., a `NotificationProvider` protocol with `send_sms`/`send_whatsapp` methods).
2. Ship a default implementation that logs/no-ops safely (or writes to an in-app `notifications` table instead of an external channel) so the rest of the system keeps working end-to-end in dev/demo.
3. Add the missing env vars to `.env.example` with a comment on where to get them.
4. Mark the task `[x]` with a note: `Done (stubbed — needs <SERVICE> credentials to go live)`.
5. Keep moving to the next task. Never let a missing API key block unrelated work.

---

## 10. Git Conventions

- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- One logical change per commit.
- One branch per Phase (or per task group within a large phase), merged via PR even if the agent is the only reviewer — this keeps CI gating meaningful.

---

## 11. Things the Agent Must Never Do

- Never fabricate data in a production code path (e.g., a hardcoded fake OSRM distance) — fabricated/fixture data belongs only in tests.
- Never silently skip a checklist item because it's hard; if genuinely blocked, log it in the Deviations Log with the reason.
- Never weaken the sub-500ms requirement, the RLS requirement, or the bid-signature-verification requirement to make a task easier — these are load-bearing for the project's credibility as a hackathon submission.
- Never assume India-only operation is a hard requirement, but it's a reasonable MVP default (default map bounds, default OSRM extract) — don't build anything that structurally prevents adding another country's OSM extract later.
- Never mark a task done from a "should work" read of the code — run it.

---

## 12. Third-Party Services & Credentials — What the User Needs to Provide

This is the authoritative list. Everything not on this list is either free/keyless (OSM tiles, Web Crypto, Web Push VAPID keys the agent generates itself, Web Speech API) or self-hostable with no account (OSRM via Docker).

| Service | Required or optional | What it's for | What the user must supply |
|---|---|---|---|
| **Supabase** | Required | Database, Auth, Storage, Realtime | Project URL, `anon` key, `service_role` key (Project Settings → API) |
| **Twilio** (or another SMS/WhatsApp gateway) | Optional — stubbed if absent | SMS/WhatsApp alerts to drivers with low app literacy | Account SID, Auth Token, a WhatsApp-enabled sender number |
| **MapTiler** (or Stadia Maps) | Optional — falls back to free OSM demo tiles | Nicer, higher-rate-limit map tiles for production | API key |
| A container hosting provider (Fly.io / Render / Railway — pick one) | Required only for deploying `gateway` and `solver` beyond local dev | Runs the FastAPI and Go services | Account + whatever CLI token that provider needs |
| A machine/VM with a few GB disk | Required only for production OSRM | Hosts the self-built OSRM data + `osrm-routed` | N/A — this can be the same box as the container host |

Nothing else needs a signup. VAPID keys for Web Push are generated locally by the agent (`web-push generate-vapid-keys` or the Python `py-vapid` equivalent) and just need to be stored as env vars.
