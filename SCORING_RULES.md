# ZIMRAH 2026 – Official Scoring Rules & Championship Specification

**Festival**: ZIMRAH 2026 – Song of Praise (ഗാനാലാപന മഹോത്സവം)  
**Organization**: CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement  
**Document Status**: Official & Approved Architecture Baseline  
**Revision**: 1.0 (Phase 7 Migration Baseline)

---

## 1. Core Scoring Philosophy & Formulas

### 1.1 The Authoritative Scoring Invariant (ADR-006)
In ZIMRAH 2026, total competition points are strictly computed by the additive rule:

$$\text{Total Points} = \text{Grade Points} + \text{Position Points}$$

- **Manual Entry by Administrators**: Administrators manually enter Grade, Grade Points, Position, and Position Points directly from official judges' tabulation scorecards. Points are never automatically guessed or calculated from positions alone.
- **Server-Side Recalculation**: Total points are authoritatively verified and recalculated in the database via PostgreSQL triggers (`trg_calculate_total_points`) and atomic RPC functions (`save_result_draft`, `publish_result`, `correct_published_result`). Frontend calculations are never trusted.
- **Fractional Decimal Precision**: All points are stored using `DECIMAL(6,2)` across `result_entries.grade_points`, `result_entries.position_points`, `result_entries.total_points`, and `point_ledger.points`. This eliminates floating-point rounding drift (e.g., $3.50 + 2.25 = 5.75$).

---

## 2. Event Types & Championship Attribution

### 2.1 Individual Events
An event where an individual contestant represents their parish church (e.g. *EV01 Solo Eastern*, *EV11 Classical Music*, *EV29 Essay Writing*).
- **Church Championship**: The church of the participant receives the entry's `total_points` in the active `point_ledger` with `target = 'CHURCH'`.
- **Individual Championship**: The participant receives the entry's `total_points` in the active `point_ledger` with `target = 'INDIVIDUAL'` (provided `events.contributes_to_individual = TRUE`).

### 2.2 Group Events & Team Contests
An event where a team of contestants represents their parish church (e.g. *EV15 Group Song*, *EV16 Quartet*, *EV21 Mime*, *EV23 Tableau*, *EV24 Skit*).
- **Single Church Credit Rule**: In all group competitions, the parish church is credited with the team's `total_points` strictly **once**. Group points are **never** multiplied by the number of participants on the roster.
- **Individual Championship Attribution**:
  - Group event points contribute to the individual championship strictly for the verified participants enrolled in that registered group roster (`GroupRegistrationMember` / `ResultParticipant`).
  - Individual points must not be awarded to unrelated participants.
  - To prevent individual score explosion, individual points are attributed based on explicit allocation (`result_participants.points_allocated`). In team choirs where group performance points belong exclusively to the church, individual points remain zero unless explicit member allocation is declared.

---

## 3. The 5-Level Tie-Breaking Hierarchy

When sorting church or individual standings, competitors are ranked by evaluating the following 5 criteria in exact descending order of precedence:

```text
Level 1: Total Championship Points (Highest Points Wins)
   │
   ▼ (if tied)
Level 2: Count of 1st Places Awarded (Most 1st Positions Wins)
   │
   ▼ (if tied)
Level 3: Count of 2nd Places Awarded (Most 2nd Positions Wins)
   │
   ▼ (if tied)
Level 4: Count of 3rd Places Awarded (Most 3rd Positions Wins)
   │
   ▼ (if tied)
Level 5: Count of Grade A Awards (Most Grade A Marks Wins)
   │
   ▼ (if tied on all 5 criteria)
Equal Rank (Standard Competition Ranking)
```

### 3.1 Standard Competition Ranking (1224 Ranking)
If two or more competitors have identical scores on all five criteria:
1. They share the identical rank (`is_tied = TRUE`).
2. The next competitor in the standings receives their true numerical rank based on the count of competitors ahead of them.

**Example**:
```text
1st Place: Parish Alpha (20.00 pts, two 1st)
2nd Place: Parish Gamma (10.00 pts, one 1st)
3rd Place: Parish Beta  (10.00 pts, zero 1st, two 2nd, two Grade A) [TIED]
3rd Place: Parish Delta (10.00 pts, zero 1st, two 2nd, two Grade A) [TIED]
5th Place: Parish Epsilon (8.00 pts)
```
*(Notice Parish Epsilon is 5th, not 4th. Ranks are 1, 2, 3, 3, 5).*

### 3.2 Deterministic Secondary Display Order
Within a shared tied rank, rows are displayed deterministically:
- **Church Leaderboard**: Alphabetical order by church name (`church_name ASC`).
- **Individual Leaderboard**: Alphanumeric order by chest number (`chest_number ASC`).
This ordering is purely visual for table rendering and **does not alter the official shared rank** of the competitors.

---

## 4. The Point Ledger Architecture

The `public.point_ledger` table is the authoritative transactional ledger that feeds all championship standings:

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Unique transaction identifier |
| `edition_id` | `UUID` | Festival edition reference |
| `result_entry_id` | `UUID` | Source verified result entry |
| `event_id` | `UUID` | Competition event reference |
| `church_id` | `UUID` | Parish church credited |
| `participant_id` | `UUID NULL` | Contestant credited (for `INDIVIDUAL` target) |
| `target` | `VARCHAR(20)` | `CHURCH` or `INDIVIDUAL` |
| `points` | `DECIMAL(6,2)` | Points awarded |
| `is_active` | `BOOLEAN` | `TRUE` if currently counting towards standings |
| `created_at` | `TIMESTAMPTZ` | Timestamp of allocation |

### 4.1 Ledger Invariants & Constraints
1. **Duplicate Prevention**:
   - Partial unique index `idx_unique_active_church_ledger` on `(result_entry_id, target) WHERE (target = 'CHURCH' AND is_active = TRUE)`.
   - Partial unique index `idx_unique_active_participant_ledger` on `(result_entry_id, participant_id, target) WHERE (target = 'INDIVIDUAL' AND is_active = TRUE AND participant_id IS NOT NULL)`.
2. **Result Lifecycle Integration**:
   - **Publish**: Atomically generates active ledger records (`is_active = TRUE`).
   - **Unpublish**: Atomically deactivates all ledger records (`is_active = FALSE`).
   - **Correction**: Atomically deactivates previous ledger records and writes updated active records with audit trail diffs.
3. **Standings Isolation**: Standings aggregation views only sum records where `is_active = TRUE`. Draft or unpublished results never pollute the public leaderboard.

---

## 5. Individual Championship Divisions

The Individual Championship recognizes titleholders (Kalathilakam / Kalaprathibha) across three official views:
1. **Overall Championship**: All contestants across all age categories.
2. **Junior Division Championship**: Contestants in the `JUNIOR` age category.
3. **Senior Division Championship**: Contestants in the `SENIOR` age category.
