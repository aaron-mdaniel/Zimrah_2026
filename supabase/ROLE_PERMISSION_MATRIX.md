# ZIMRAH 2026 – Role-Based Access Control (RBAC) & Security Permission Matrix

## 1. Overview & Security Architecture

ZIMRAH 2026 enforces a defense-in-depth security model across four tiers:
1. **Database Row Level Security (RLS)**: Enforced directly within PostgreSQL kernel via `FORCE ROW LEVEL SECURITY`. Every request must satisfy security policies evaluated against `auth.uid()` and verified roles.
2. **PostgreSQL Security Definer Functions & Triggers**:
   - `trg_prevent_role_escalation`: Prevents non-super-admins from mutating `role` or `is_active` in `user_profiles`.
   - `trg_enforce_result_publishing`: Rejects result publication or unpublishing attempts by unauthorized users (`RESULT_ADMIN` or anonymous).
3. **Application Layer Route & Component Guards**:
   - React `ProtectedRoute` with strict `allowedRoles` enforcement.
   - Dynamic UI sidebar filtering preventing access to unauthorized navigation items.
4. **Network & Edge Security**:
   - HTTP Security Headers (`Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `X-Content-Type-Options`) defined in `vercel.json`.
   - Rate limiting via Upstash Redis at edge/API entry points.

---

## 2. System Roles & Responsibilities

| Role | Description | Scope of Authority |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | System Administrator & Chief Adjudicator | Full unrestricted administrative access. Manages users, editions, churches, events, participants, and registrations. Can enter scores, publish/unpublish results, trigger recalculations, and review immutable audit trails. |
| **`RESULT_ADMIN`** | Tabulation Officer / Data Entry Specialist | Operational data management. Manages participants, registrations, rosters, and enters/edits scores and raw timings/ranks. Cannot publish results, cannot edit master competition definitions, cannot modify user profiles, and cannot view audit logs. |
| **`PUBLISHER`** | Official Reviewer & Release Officer | Editorial and publication review. Reviews submitted results, verifies tie-breaks and penalties, publishes official results, triggers championship ledger updates, and unpublishes results for correction if needed. Cannot alter master entities. |
| **`PUBLIC` / `anon`** | Unauthenticated Public Visitors | Read-only access strictly confined to `PUBLISHED` results, active competition details, published church standings, and published individual leaderboards. Zero write access. Drafts, hidden events, participant details, and audit logs are completely invisible. |

---

## 3. Database Table Permissions Matrix (PostgreSQL RLS)

Legend:
- **`SELECT`**: Read rows
- **`INSERT`**: Create rows
- **`UPDATE`**: Edit rows
- **`DELETE`**: Remove rows
- 🟢 **Allowed**: Unrestricted or full scope for this role
- 🟡 **Conditional**: Allowed with row-level filter (e.g. only own profile, only published results)
- 🔴 **Forbidden**: Denied by RLS policy or trigger (database will reject with 0 rows or error)

| # | Database Table | Operation | `PUBLIC` (anon) | `RESULT_ADMIN` | `PUBLISHER` | `SUPER_ADMIN` | Policy Enforcement Rule |
| :-: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | `user_profiles` | `SELECT` | 🔴 | 🟡 (Own Profile) | 🟡 (Own Profile) | 🟢 (All Profiles) | `id = auth.uid()` OR `is_super_admin()` |
| | | `INSERT` | 🔴 | 🔴 | 🔴 | 🟢 | Only Super Admin can invite/create profiles |
| | | `UPDATE` | 🔴 | 🟡 (Self except role) | 🟡 (Self except role) | 🟢 | Trigger `trg_prevent_role_escalation` blocks role escalation |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Only Super Admin |
| **2** | `editions` | `SELECT` | 🟡 (`is_active = true`) | 🟢 | 🟢 | 🟢 | Public only sees active edition |
| | | `INSERT` | 🔴 | 🔴 | 🔴 | 🟢 | Only Super Admin |
| | | `UPDATE` | 🔴 | 🔴 | 🔴 | 🟢 | Only Super Admin |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Only Super Admin |
| **3** | `churches` | `SELECT` | 🟢 | 🟢 | 🟢 | 🟢 | Public church directory |
| | | `INSERT` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| | | `UPDATE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| **4** | `event_categories` | `SELECT` | 🟢 | 🟢 | 🟢 | 🟢 | Public reference data |
| | | `INSERT`/`UPDATE`/`DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| **5** | `event_divisions` | `SELECT` | 🟢 | 🟢 | 🟢 | 🟢 | Public reference data |
| | | `INSERT`/`UPDATE`/`DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| **6** | `event_sections` | `SELECT` | 🟢 | 🟢 | 🟢 | 🟢 | Public reference data |
| | | `INSERT`/`UPDATE`/`DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| **7** | `events` | `SELECT` | 🟡 (`is_active = true`) | 🟢 | 🟢 | 🟢 | Public only sees active competition events |
| | | `INSERT`/`UPDATE`/`DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Master data: Super Admin only |
| **8** | `participants` | `SELECT` | 🔴 | 🟢 | 🟢 | 🟢 | PII Protection: Private contestant directory |
| | | `INSERT`/`UPDATE` | 🔴 | 🟢 | 🔴 | 🟢 | Result Admins & Super Admins register contestants |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Cascade safety: Super Admin only |
| **9** | `registrations` | `SELECT` | 🔴 | 🟢 | 🟢 | 🟢 | Private team & individual registrations |
| | | `INSERT`/`UPDATE` | 🔴 | 🟢 | 🔴 | 🟢 | Result Admins & Super Admins manage rosters |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **10** | `group_registration_members` | `SELECT` | 🔴 | 🟢 | 🟢 | 🟢 | Private group roster details |
| | | `INSERT`/`UPDATE` | 🔴 | 🟢 | 🔴 | 🟢 | Result Admins & Super Admins manage rosters |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **11** | `event_results` | `SELECT` | 🟡 (`status = 'PUBLISHED'`) | 🟢 | 🟢 | 🟢 | Public cannot see `DRAFT` or `SUBMITTED` results |
| | | `INSERT` | 🔴 | 🟢 | 🔴 | 🟢 | Result Admin creates score sheets |
| | | `UPDATE` | 🔴 | 🟡 (Score fields only) | 🟢 (Can set `PUBLISHED`) | 🟢 (Full) | Trigger `trg_enforce_result_publishing` blocks unauthorized publish |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **12** | `result_entries` | `SELECT` | 🟡 (If parent `PUBLISHED`) | 🟢 | 🟢 | 🟢 | Entry rows linked to published results |
| | | `INSERT`/`UPDATE` | 🔴 | 🟢 | 🔴 | 🟢 | Score/rank entry |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **13** | `result_participants` | `SELECT` | 🟡 (If parent `PUBLISHED`) | 🟢 | 🟢 | 🟢 | Public sees contestant names only on published results |
| | | `INSERT`/`UPDATE` | 🔴 | 🟢 | 🔴 | 🟢 | Result entry linkage |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **14** | `point_ledger` | `SELECT` | 🟢 | 🟢 | 🟢 | 🟢 | Public church and individual leaderboard aggregation |
| | | `INSERT`/`UPDATE` | 🔴 | 🔴 | 🟢 | 🟢 | Publisher or Super Admin records points upon publishing |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🟢 | Super Admin only |
| **15** | `audit_logs` | `SELECT` | 🔴 | 🔴 | 🔴 | 🟢 | Security restriction: Super Admin only |
| | | `INSERT` | 🔴 | 🟢 (Via trigger/action) | 🟢 (Via trigger/action) | 🟢 (Via trigger/action) | Append-only security log |
| | | `UPDATE` | 🔴 | 🔴 | 🔴 | 🔴 | **IMMUTABLE**: Zero UPDATE policies exist |
| | | `DELETE` | 🔴 | 🔴 | 🔴 | 🔴 | **IMMUTABLE**: Zero DELETE policies exist |

---

## 4. Frontend Route & Component Authorization Matrix

| Route Path | Page Component | `PUBLIC` | `RESULT_ADMIN` | `PUBLISHER` | `SUPER_ADMIN` | Fallback / Guard Behavior |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `/` | `HomePage` | 🟢 | 🟢 | 🟢 | 🟢 | Public accessible |
| `/events` | `EventsPage` | 🟢 | 🟢 | 🟢 | 🟢 | Public accessible |
| `/results` | `ResultsPage` | 🟢 | 🟢 | 🟢 | 🟢 | Shows published results only |
| `/results/:code` | `ResultDetailPage` | 🟢 | 🟢 | 🟢 | 🟢 | 404 if draft/unpublished |
| `/championship/church` | `ChurchLeaderboardPage` | 🟢 | 🟢 | 🟢 | 🟢 | Public standings |
| `/championship/individual` | `IndividualLeaderboardPage` | 🟢 | 🟢 | 🟢 | 🟢 | Public standings |
| `/search` | `SearchPage` | 🟢 | 🟢 | 🟢 | 🟢 | Public search |
| `/portal/login` | `LoginPage` | 🟢 | 🟢 | 🟢 | 🟢 | Redirects to dashboard if already authenticated |
| `/portal/reset-password` | `ResetPasswordPage` | 🟢 | 🟢 | 🟢 | 🟢 | Password update with reset token |
| `/portal/dashboard` | `DashboardPage` | 🔴 | 🟢 | 🟢 | 🟢 | Redirects to `/portal/login` |
| `/portal/results` | `ResultEntryAdminPage` | 🔴 | 🟢 | 🟢 | 🟢 | Renders `UnauthorizedPage` if unauthorized |
| `/portal/churches` | `ChurchesAdminPage` | 🔴 | 🔴 | 🔴 | 🟢 | Renders `UnauthorizedPage` |
| `/portal/participants` | `ParticipantsAdminPage` | 🔴 | 🟢 | 🔴 | 🟢 | Renders `UnauthorizedPage` |
| `/portal/events` | `EventsAdminPage` | 🔴 | 🔴 | 🔴 | 🟢 | Renders `UnauthorizedPage` |
| `/portal/registrations` | `RegistrationsAdminPage` | 🔴 | 🟢 | 🔴 | 🟢 | Renders `UnauthorizedPage` |
| `/portal/championships` | `ChampionshipsAdminPage` | 🔴 | 🔴 | 🟢 | 🟢 | Renders `UnauthorizedPage` |
| `/portal/audit` | `AuditLogsAdminPage` | 🔴 | 🔴 | 🔴 | 🟢 | Renders `UnauthorizedPage` |

---

## 5. Security Trigger Enforcement

### 1. `trg_prevent_role_escalation`
- **Location**: `public.user_profiles`
- **Trigger Timing**: `BEFORE UPDATE`
- **Behavior**:
  - Compares `OLD.role` vs `NEW.role` and `OLD.is_active` vs `NEW.is_active`.
  - If any change is detected, calls `is_super_admin()`.
  - If the session user is not `SUPER_ADMIN`, raises exception:
    `Access Denied: Only SUPER_ADMIN can modify user roles or active status.`

### 2. `trg_enforce_result_publishing`
- **Location**: `public.event_results`
- **Trigger Timing**: `BEFORE UPDATE`
- **Behavior**:
  - Compares `OLD.status` vs `NEW.status`.
  - If state transitions to `PUBLISHED` or transitions out of `PUBLISHED`, calls `is_publisher()`.
  - If the user is neither `PUBLISHER` nor `SUPER_ADMIN`, raises exception:
    `Access Denied: Only PUBLISHER or SUPER_ADMIN can publish or unpublish event results.`

### 3. `trg_audit_trail_immutable`
- **Location**: `public.audit_logs`
- **Behavior**:
  - No `UPDATE` or `DELETE` RLS policies exist.
  - PostgreSQL will reject any update or delete statement with `0 rows affected` or error even if attempted with authenticated user claims.

---

## 6. Verification & Automated Test Coverage

The test suite in `scripts/test_security_rls.py` validates this matrix with **16 automated test assertions directly against PostgreSQL**:
1. Anonymous users cannot view unpublished results (`status != 'PUBLISHED'`).
2. Anonymous users can view published results.
3. Anonymous users cannot view user profiles.
4. Anonymous users cannot view audit logs.
5. Anonymous users cannot insert participants.
6. Anonymous users cannot insert event results.
7. `RESULT_ADMIN` can view unpublished results.
8. `RESULT_ADMIN` cannot view other administrators' profiles.
9. `RESULT_ADMIN` cannot escalate their own role to `SUPER_ADMIN`.
10. `RESULT_ADMIN` cannot publish event results.
11. `PUBLISHER` can publish event results.
12. `PUBLISHER` cannot modify church master data.
13. `SUPER_ADMIN` has full access to view audit logs.
14. `SUPER_ADMIN` can update user profiles and roles.
15. Audit logs cannot be updated by any role (immutability).
16. Audit logs cannot be deleted by any role (immutability).
