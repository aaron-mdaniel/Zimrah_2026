# ZIMRAH 2026 – Architecture Decision Records (ADR)

## Index of Architectural Decisions

- **ADR-001**: Architectural Preservation & Layer Boundary Enforcement
- **ADR-002**: Frontend Technology Stack (React + Vite + Tailwind CSS + shadcn/ui)
- **ADR-003**: Supabase PostgreSQL, Row Level Security (RLS) & RPC Functions
- **ADR-004**: Scoring Rule Reconciliation – Group Event Individual Championship Attribution
- **ADR-005**: String-Based Chest Number Storage & Leading-Zero Preservation
- **ADR-006**: Server-Side Authoritative Score Calculation Invariant
- **ADR-007**: Distributed Generation-Based Caching via Upstash Redis
- **ADR-008**: PWA Architecture with Workbox & Offline Shell
- **ADR-009**: Edge Security, Security Headers & Sliding-Window Rate Limiting

---

### ADR-001: Architectural Preservation & Layer Boundary Enforcement
- **Status**: Accepted
- **Context**: The existing Django system is organized into 4 layers (Clients/Presentation, Edge/CDN, Application Layer with 8 logical modules and 3 domain services, Data/Caching). The prompt mandates preserving this exact architecture without redesign.
- **Decision**: 
  - Retain the 8 logical domain modules: `accounts`, `churches`, `participants`, `events`, `registrations`, `results`, `championships`, `audit`.
  - Retain the 3 domain service contracts: `ResultService`, `ChampionshipService`, `CacheService`.
  - Preserve the clear boundary between Public and Administrative views.
  - Implement business rules inside PostgreSQL RPC functions and Edge Functions rather than relying on browser-side execution.
- **Consequences**: Zero loss of business logic or separation of concerns; clean transition between Django Python services and Supabase PostgreSQL RPCs / TypeScript client wrappers.

---

### ADR-002: Frontend Technology Stack
- **Status**: Accepted
- **Context**: The existing frontend consists of Django Templates + Bootstrap 5.3 + Vanilla JS. We are migrating to a modern, type-safe Single Page Application (SPA) with PWA capabilities.
- **Decision**:
  - **Framework**: React 19 + TypeScript (Strict Mode) + Vite 6.
  - **Routing**: `react-router` (v7 / v6 latest) with dedicated public routes (`/`, `/results`, `/results/:code`, `/championship/church`, `/championship/individual`, `/search`) and protected admin portal routes (`/portal`, `/portal/login`, `/portal/dashboard`, `/portal/results/*`, `/portal/churches/*`, `/portal/participants/*`, `/portal/events/*`, `/portal/registrations/*`).
  - **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives) preserving the ZIMRAH brand colors (Forest Emerald `#064e3b`, Deep Gold `#f59e0b`, Slate White `#f8fafc`).
  - **State Management & Caching**: TanStack Query (React Query) for server state caching and 25-second background polling synchronization.
  - **Form Validation**: React Hook Form with Zod schemas matching Django form validators.
  - **Icons**: Lucide React.
- **Consequences**: Fast client-side transitions, component reusability, strict compile-time type safety, and identical branding.

---

### ADR-003: Supabase PostgreSQL, Row Level Security (RLS) & RPC Functions
- **Status**: Accepted
- **Context**: Django ORM handled multi-table joins, transactions (`@transaction.atomic`), and row locking (`select_for_update`). Public visitors require sub-50ms reads; administrators require role-enforced writes.
- **Decision**:
  - Replicate all 10 Django models as relational PostgreSQL tables in Supabase with identical column types, decimal precision (`DECIMAL(5,2)`, `DECIMAL(6,2)`), unique constraints, and composite indexes.
  - Use Supabase Auth for identity management. Assign roles (`SUPER_ADMIN`, `RESULT_ADMIN`, `PUBLISHER`) via `user_profiles` table and JWT custom claims.
  - Enforce PostgreSQL Row Level Security (RLS):
    - Public: `SELECT` allowed on `events`, `event_categories`, `event_divisions`, `event_sections`, `churches` (active only), `published` `event_results`, `result_entries` (for published results), and active `point_ledger` entries.
    - Admin: Role-based policies enforcing exact Django permissions.
  - Transactional operations (`save_result_draft`, `publish_result`, `unpublish_result`, `correct_published_result`, `bulk_import_participants`) are encapsulated in PostgreSQL RPC functions (`SECURITY DEFINER`) to guarantee ACID atomicity and prevent race conditions.
- **Consequences**: Backend authorization is enforced at the database kernel level; no client manipulation can bypass security.

---

### ADR-004: Scoring Rule Reconciliation – Group Event Individual Championship Attribution
- **Status**: Accepted (Discrepancy Reconciled per Section 5.F)
- **Context**: 
  - The existing `README.md` (lines 43-44) stated: *"Group events contribute points exclusively to the church championship standings. Group points are mathematically prevented from inflating individual contestant rankings."*
  - In `seed_master_data.py`, group events (EV15, EV16, EV23, EV24) were seeded with `contributes_to_individual = False`.
  - In `tests/test_phase5_public_and_championship.py` (lines 117-148), `test_group_points_do_not_inflate_individual_scores` asserted that group members received 0 individual points.
  - However, in `apps/results/migrations/0002_resultparticipant_points_allocated.py`, a `points_allocated` decimal field was introduced on `ResultParticipant`, and `apps/results/services.py` lines 188-199 credited individual points if `rp.points_allocated > 0`.
  - The Master Prompt (Section 5.F) explicitly mandates:
    *"The latest approved ZIMRAH project requirements specify: Individual event points count towards individual championship; Group event points count towards both church and individual championships. The latest approved requirements take priority."*
- **Decision**:
  - We reconcile this discrepancy completely in favor of the latest approved requirements.
  - Church Championship: Receives the full `total_points` of the team's result entry once per church team.
  - Individual Championship: For group events, points count towards the individual championship of the registered group participants (`GroupRegistrationMember` / `ResultParticipant`).
  - Allocation Rule:
    - Default behavior: In group events, all registered members of the placing team are credited with the team's earned points (or an approved equal fractional share/configurable points via `ResultParticipant.points_allocated`).
    - Only registered group members of the specific church team entry receive points (strictly verified against `GroupRegistrationMember`). Points are never awarded to unassociated participants.
  - Update all documentation and rewrite the migrated test cases to validate that group event participants actively receive individual championship points.
- **Consequences**: Consistent, fair attribution aligning with official diocese championship bylaws.

---

### ADR-005: String-Based Chest Number Storage & Leading-Zero Preservation
- **Status**: Accepted
- **Context**: Contestant chest numbers (e.g. `001`, `042`, `009`, `Q01`, `GRP-01`) convey festival identification and frequently contain leading zeros or alphanumeric prefixes. Converting them to integers destroys leading zeroes (`001` becomes `1`), breaking stage sheets and contestant badges.
- **Decision**:
  - Model `chest_number` strictly as `VARCHAR(20)` / `TEXT` in Supabase PostgreSQL.
  - Enforce string type across TypeScript interfaces (`chest_number: string`).
  - Add database-level check constraints and unique constraints on `(edition_id, chest_number)` for participants and individual registrations.
  - Sanitize and preserve strings during CSV import and form submissions.
- **Consequences**: Preserves full fidelity of printed badges, chest numbers, and search indexing.

---

### ADR-006: Server-Side Authoritative Score Calculation Invariant
- **Status**: Accepted
- **Context**: Total points calculation: $\text{Total Points} = \text{Grade Points} + \text{Position Points}$. Malicious or malfunctioning browser clients must never be able to submit fraudulent total points.
- **Decision**:
  - Calculate `total_points = grade_points + position_points` exclusively inside the PostgreSQL database (via `BEFORE INSERT OR UPDATE` trigger and RPC functions).
  - Browser total points input is purely a client-side visual calculation and is ignored/overwritten on the server.
  - Grade points and position points are stored with `DECIMAL(5,2)` precision to prevent floating-point rounding drift.
- **Consequences**: Absolute scoring integrity and mathematical consistency.

---

### ADR-007: Distributed Generation-Based Caching via Upstash Redis
- **Status**: Accepted
- **Context**: The existing system uses an atomic generation key (`zimrah:cache_generation`) to achieve $\mathcal{O}(1)$ global cache invalidation whenever a result is published, corrected, or unpublished.
- **Decision**:
  - Implement `CacheService` in TypeScript backed by `@upstash/redis` (REST HTTP API for edge-readiness).
  - Generation key: `zimrah:cache_generation`.
  - Cache key pattern: `zimrah:v{generation}:{namespace}:{hash(identifier)}`.
  - Invalidation: `redis.incr('zimrah:cache_generation')` advances generation token in <10ms, instantly invalidating all cached leaderboards across all Vercel edge instances and serverless functions without iterating or deleting keys.
  - Standard TTL: 300 seconds (5 minutes) for leaderboards, 60 seconds for live summary.
- **Consequences**: Lightning-fast cache hits (15–25ms), zero stale scores during live events.

---

### ADR-008: PWA Architecture with Workbox & Offline Shell
- **Status**: Accepted
- **Context**: The festival venues (Thazhathmon & Munroethuruth) may experience erratic network connectivity. An installable PWA with offline application shell is mandatory.
- **Decision**:
  - Configure `vite-plugin-pwa` with Workbox.
  - Web App Manifest: Name `ZIMRAH 2026 – Song of Praise`, short name `ZIMRAH 2026`, theme `#064e3b`, icons 192x192 and 512x512 maskable.
  - Caching strategies:
    - Static Assets (`/assets/*`, fonts, logos): Cache-First with 1-year max age.
    - Public Scorecards & Leaderboards (`/api/*`): Network-First with Cache fallback.
    - Background polling: 25-second interval when online, gracefully paused when offline.
    - Administrative routes (`/portal/*`, Supabase Auth): Strictly excluded from service worker caching.
- **Consequences**: Smooth offline browsing experience for spectators and judges; zero leakage of sensitive admin data into public device caches.

---

### ADR-009: Edge Security, Security Headers & Sliding-Window Rate Limiting
- **Status**: Accepted
- **Context**: The application must withstand public traffic spikes (100+ concurrent users) and protect admin/result interfaces against brute force and DDoS.
- **Decision**:
  - Configure `vercel.json` with strict security headers:
    - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; ...`
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - Implement IP rate limiting using Upstash Redis sliding window (600 requests per minute per IP on public/API routes).
- **Consequences**: Production-grade edge hardening matching enterprise compliance standards.
