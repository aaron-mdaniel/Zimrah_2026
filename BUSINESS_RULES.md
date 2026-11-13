# ZIMRAH 2026 – Business Rules Reference Manual

This document is the authoritative specification for all business logic, scoring algorithms, validation constraints, and workflows in **ZIMRAH 2026 – Song of Praise**.

---

## 1. Church / Parish Management

1. **Unique Code**: Every church must have a unique identifier code (e.g. `CH01`, `STC01`, `HTC02`). Codes must be stored in uppercase and trimmed of whitespace.
2. **Name & Malayalam Name**: Each church has an English name (e.g. "St. Mathias CSI Church, Munroethuruth") and an optional Malayalam name (e.g. "സെന്റ് മത്ഥിയാസ് സി.എസ്.ഐ ചർച്ച്, മൺറോത്തുരുത്ത്").
3. **District**: Belongs to an administrative district, default "Adoor Clergy District".
4. **Active Status**: Churches can be toggled `is_active = True/False`. Deactivated churches cannot be selected for new participant registrations.
5. **Participant Association**: Deleting a church is prohibited if participants or registrations are linked (`ON DELETE PROTECT`).
6. **Authorization**:
   - `SUPER_ADMIN`: Can Create, Edit, and Toggle Status.
   - `RESULT_ADMIN` / `PUBLISHER`: Can View Church List and Details.
   - Public: Can view active church profiles and public standings.

---

## 2. Participant Registry

1. **Chest Number**:
   - **Type**: Stored strictly as a string (`VARCHAR(20)`).
   - **Leading-Zero Preservation**: Leading zeros (e.g., `001`, `007`, `042`, `099`) must NEVER be converted to integers or truncated.
   - **Uniqueness**: Must be unique within the active festival edition: `UNIQUE(edition_id, chest_number)`.
2. **Name & Malayalam Name**: Participant's full legal name in English and optional Malayalam script.
3. **Gender**: Constrained to `'M'` (Male) or `'F'` (Female).
4. **Age Category**:
   - `JUNIOR`: For contestants eligible for Junior category.
   - `SENIOR`: For contestants eligible for Senior category.
   - `OPEN`: For competitions open to all age brackets.
5. **Church Association**: Every participant must be associated with exactly one active Church (`ON DELETE PROTECT`).
6. **CSV Bulk Import**:
   - Accepts UTF-8 with BOM (Microsoft Excel export compatibility) or UTF-8 / Latin-1.
   - Required columns: `chest_number`, `name`, `gender`, `church_code`.
   - Optional columns: `name_malayalam`, `age_category`, `phone`.
   - Validates church existence by code.
   - Skips duplicate chest numbers with detailed error report.
   - Atomic transaction: records are committed safely.
7. **Authorization**:
   - `SUPER_ADMIN` and `RESULT_ADMIN`: Can Create, Edit, Import, and Search participants.
   - `PUBLISHER`: Can View participants.
   - Public: Searchable only via published scorecards.

---

## 3. Festival Editions, Categories & Competitions

1. **Edition**:
   - Year: Positive integer (e.g., `2026`), unique.
   - Title: "ZIMRAH 2026", Theme: "Song of Praise".
   - Active Flag: Exactly one edition is marked `is_active = True` as the primary festival.
2. **Event Categories**:
   - **Literary Events (സാഹിത്യ മത്സരങ്ങൾ)**: Date: 8 Nov 2026, Venue: Thazhathmon, TVM.
   - **Stage Events (സ്റ്റേജ് മത്സരങ്ങൾ)**: Date: 14 Nov 2026, Venue: St. Mathias CSI Church, Munroethuruth.
3. **Event Divisions**:
   - Division 1: **Music (സംഗീതം)** – 16 Competitions (EV01 to EV16)
   - Division 2: **Fine Arts (ഫൈൻ ആർട്സ്)** – 3 Competitions (EV17 to EV19)
   - Division 3: **Theater (തീയറ്റർ മത്സരങ്ങൾ)** – 5 Competitions (EV20 to EV24)
   - Division 4: **Writing & Elocution (രചന പ്രസംഗ മത്സരങ്ങൾ)** – 10 Competitions (EV25 to EV34)
   - Total: **34 Competitions**.
4. **Event Sections**:
   - `JB` (Junior Boys), `JG` (Junior Girls), `SB` (Senior Boys), `SG` (Senior Girls), `JUNIOR`, `SENIOR`, `OPEN`.
5. **Event Types**:
   - `INDIVIDUAL`: 1 participant per entry (`min_participants = 1`, `max_participants = 1`).
   - `GROUP`: Team competitions (e.g. Quartet: 4 members; Choir: 4–12 members; Tableau: 4–15 members; Mime: 4–10 members).
6. **Authorization**:
   - `SUPER_ADMIN`: Can Create, Edit, and Seed master event configurations.

---

## 4. Registration Management

1. **Individual Registrations**:
   - Single participant registered for an individual event.
   - **Church Membership Invariant**: Participant's church must match the registration's church.
   - **Duplicate Prevention Invariant**: A participant cannot be registered twice for the same event (`UNIQUE(event_id, participant_id)`).
   - Chest Number: Default to participant's primary chest number if not overridden.
2. **Group Registrations**:
   - A team representing a church for a group event.
   - Group name (e.g., "St. Mathias Choir", "Munroethuruth Team A").
   - Group chest number (e.g., `G01`, `Q01`).
   - **Church Membership Invariant**: Every member participant in `GroupRegistrationMember` must belong to the registered church.
   - **Team Size Invariant**: Must satisfy `min_participants <= member_count <= max_participants`.
   - **Duplicate Member Invariant**: A participant cannot belong to more than one registered team in the same group event.
3. **Stage Sheets & Rosters**:
   - Filterable and printable by event code.
   - Displays chest numbers, contestant names, church codes, and space for judges' scoring.

---

## 5. Result Entry & Scoring Engine

1. **Result Workflow State Machine**:
   $$\text{DRAFT} \longrightarrow \text{PREVIEW} \longrightarrow \text{PUBLISHED} \longleftrightarrow \text{UNPUBLISHED (DRAFT)}$$
   $$\text{PUBLISHED} \xrightarrow{\text{Reason}} \text{CORRECTED (PUBLISHED)}$$
2. **Server-Side Authoritative Calculation Invariant**:
   $$\text{Total Points} = \text{Grade Points} + \text{Position Points}$$
   - Any `total_points` value submitted by client browsers is strictly rejected/ignored.
   - Grade points and position points are validated and stored as `DECIMAL(5,2)`.
   - Standard Grade Options: `A` (Grade A), `B` (Grade B), `C` (Grade C).
   - Standard Position Options: `1` (1st Position), `2` (2nd Position), `3` (3rd Position), or null/unplaced.
3. **Draft State**:
   - Saved with status `DRAFT`.
   - Zero point ledger entries exist while in draft.
   - Strictly invisible to public users and REST APIs (API returns 404 or empty list).
4. **Publishing Action**:
   - Only permitted for `SUPER_ADMIN` or `PUBLISHER`.
   - Atomically updates status to `PUBLISHED`, records `published_by` and `published_at = NOW()`.
   - Generates immutable `PointLedger` entries with `is_active = True`.
   - Church points are credited once per team result.
   - Triggers distributed cache invalidation (`CacheService.invalidate_all()`).
5. **Unpublishing Action**:
   - Reverts status to `DRAFT`.
   - Immediately deactivates all related `PointLedger` entries (`is_active = False`).
   - Creates `RESULT_UNPUBLISHED` audit record with required reason.
   - Triggers `CacheService.invalidate_all()`.
6. **Result Correction Action**:
   - Applied to an already published result without having to delete records.
   - Requires a mandatory explanation/reason.
   - Atomically deactivates previous ledger entries and posts recalculated ledger entries.
   - Creates `RESULT_CORRECTED` audit log capturing full `{old_scores, new_scores, reason}` JSON delta.
   - Triggers `CacheService.invalidate_all()`.

---

## 6. Championship Ranking & Tie-Breaking Engine

1. **PointLedger Invariants**:
   - Ledger stores points earned from published results.
   - Target is partitioned into:
     - `CHURCH`: Counts toward the Parish Championship.
     - `INDIVIDUAL`: Counts toward the Individual Championship.
   - Only records with `is_active = True` are aggregated.
2. **Scoring Rule Reconciliation (Group Events)**:
   - Church Championship: Receives the team's total points once.
   - Individual Championship: Group event points count toward individual championships for all registered group participants of that winning entry (`GroupRegistrationMember` / `ResultParticipant`).
3. **5-Level Tie-Breaking Hierarchy**:
   When ordering churches or individual participants, the sorting criteria are evaluated in this exact strict precedence:
   1. **Total Points** (Descending: highest points wins)
   2. **Count of 1st Places** (Descending: most 1st positions wins)
   3. **Count of 2nd Places** (Descending: most 2nd positions wins)
   4. **Count of 3rd Places** (Descending: most 3rd positions wins)
   5. **Count of Grade A Awards** (Descending: most Grade A marks wins)
4. **Equal Rank Resolution**:
   - If two or more competitors are identical on **all 5 criteria**, they share the identical rank (`is_tied = True`).
   - Uses **Standard Competition Ranking** (e.g. 1, 2, 2, 4 — the competitor following a tied rank receives their true numerical rank).
5. **Individual Championship Categories**:
   - **Overall Individual Championship** (Kalathilakam / Kalaprathibha)
   - **Junior Individual Championship**
   - **Senior Individual Championship**
6. **Live Summary API**:
   - Total competitions (34), published competitions count, pending count, completion percentage.
   - Top-3 Churches (Gold, Silver, Bronze podium).
   - Top-3 Individuals (Gold, Silver, Bronze podium).
   - Latest 3 published results with winner names.

---

## 7. Audit Logging & Security Policies

1. **Immutability**: Audit records (`AuditLog`) are write-only. Normal administrators cannot edit or delete audit logs.
2. **Audit Attributes**:
   - `user`: Operator ID.
   - `action`: E.g., `CHURCH_CREATED`, `RESULT_DRAFT_CREATED`, `RESULT_PUBLISHED`, `RESULT_UNPUBLISHED`, `RESULT_CORRECTED`.
   - `model_name`: Affected entity.
   - `object_id`: Target record ID.
   - `object_repr`: Human-readable summary.
   - `changes`: JSON diff showing before/after state.
   - `ip_address`: Originating client IP.
   - `timestamp`: UTC creation timestamp.

---

## 8. Generation-Based Caching Invariants

1. **Generation Key**: `zimrah:cache_generation` stored in Redis.
2. **Key Format**: `zimrah:v{generation}:{namespace}:{md5(identifier)}`.
3. **Default Timeouts**:
   - Leaderboards & Standings: 300 seconds (5 minutes).
   - Live Summary: 60 seconds (1 minute).
4. **Invalidation**: On every result publication, unpublication, or correction, the generation token is atomically incremented (`INCR zimrah:cache_generation`), rendering all previous cache entries immediately stale and inaccessible in $\mathcal{O}(1)$ time.
