# ZIMRAH 2026 – Technology & Component Migration Mapping

This document details the exact, one-to-one mapping between the existing Django codebase and the target technology stack: **React + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase + Vercel + Upstash Redis**.

---

## 1. High-Level Technology Mapping Matrix

| Django Component | Target Replacement | Technical Implementation Details |
| :--- | :--- | :--- |
| **Backend Framework** | Supabase Platform | PostgreSQL database + PostgREST + RPC functions + Auth |
| **Database** | Supabase PostgreSQL 15+ | Relational schema with UUID/Integer PKs, constraints & triggers |
| **ORM & Queries** | `@supabase/supabase-js` | Type-safe queries generated from Supabase DB types |
| **Auth & Sessions** | Supabase Auth + JWT | Email/password login, JWT with role claims in session context |
| **Authorization** | PostgreSQL RLS | Database kernel security policies per role and table |
| **Admin Panel** | Custom React Admin Portal | Role-gated dashboard at `/portal/*` using Tailwind & shadcn/ui |
| **Public Views** | React SPA Pages | Responsive mobile-first public pages at `/*` |
| **Server-Side Templates** | React Components | Modular TSX components with full type safety |
| **Forms & Validation** | React Hook Form + Zod | Schema-based client validation mirroring Django Form rules |
| **Transactions** | PostgreSQL RPC Functions | ACID transactional stored procedures for results & publishing |
| **Domain Services** | TypeScript / SQL Services | `resultService.ts`, `championshipService.ts`, `cacheService.ts` |
| **Caching Layer** | Upstash Redis | Generation-based cache busting using `@upstash/redis` |
| **Security Headers** | Vercel Edge Config | Configured via `vercel.json` headers (CSP, nosniff, etc.) |
| **Rate Limiter** | Upstash Redis Sliding Window | Edge middleware or Supabase function rate limiting |
| **PWA & Offline** | `vite-plugin-pwa` + Workbox | Webmanifest + Workbox runtime caching (Cache-First/Network-First) |
| **Static Assets** | Vercel Global Edge CDN | Automatic asset caching with 1-year immutable headers |
| **Test Suite** | Vitest + Testing Library | Equivalent unit, integration, and security assertion suites |

---

## 2. Database Schema & Migration Mapping

| Django Model | Source Location | Target PostgreSQL Table | Constraints & Invariants |
| :--- | :--- | :--- | :--- |
| `accounts.User` | `apps/accounts/models.py` | `auth.users` & `public.user_profiles` | `role IN ('SUPER_ADMIN', 'RESULT_ADMIN', 'PUBLISHER')`, `phone` |
| `churches.Church` | `apps/churches/models.py` | `public.churches` | `code UNIQUE`, `name`, `name_malayalam`, `district`, `is_active` |
| `events.Edition` | `apps/events/models.py` | `public.editions` | `year UNIQUE`, `name`, `theme`, `organizer`, `is_active` |
| `events.EventCategory` | `apps/events/models.py` | `public.event_categories` | `UNIQUE(edition_id, name)`, `date`, `venue` |
| `events.EventDivision` | `apps/events/models.py` | `public.event_divisions` | `UNIQUE(edition_id, division_number)`, `name`, `name_malayalam` |
| `events.EventSection` | `apps/events/models.py` | `public.event_sections` | `UNIQUE(edition_id, code)`, `name`, `name_malayalam` |
| `events.Event` | `apps/events/models.py` | `public.events` | `UNIQUE(edition_id, code)`, `event_type IN ('INDIVIDUAL', 'GROUP')` |
| `participants.Participant` | `apps/participants/models.py` | `public.participants` | `UNIQUE(edition_id, chest_number)`, `chest_number VARCHAR(20)` |
| `registrations.Registration` | `apps/registrations/models.py` | `public.registrations` | `UNIQUE(event_id, participant_id)` (for individual), `church_id` |
| `registrations.GroupRegistrationMember`| `apps/registrations/models.py` | `public.group_registration_members` | `UNIQUE(registration_id, participant_id)` |
| `results.EventResult` | `apps/results/models.py` | `public.event_results` | `event_id UNIQUE`, `status IN ('DRAFT', 'VERIFIED', 'PUBLISHED')` |
| `results.ResultEntry` | `apps/results/models.py` | `public.result_entries` | `total_points = grade_points + position_points`, `position IN (1,2,3)` |
| `results.ResultParticipant` | `apps/results/models.py` | `public.result_participants` | `UNIQUE(result_entry_id, participant_id)`, `points_allocated` |
| `championships.PointLedger`| `apps/championships/models.py` | `public.point_ledger` | `target IN ('CHURCH', 'INDIVIDUAL')`, `points DECIMAL(6,2)`, `is_active` |
| `audit.AuditLog` | `apps/audit/models.py` | `public.audit_logs` | Write-only, `action`, `model_name`, `object_id`, `changes JSONB`, `ip` |

---

## 3. Domain Services & Business Logic Mapping

| Original Django Service | Original File | Target Implementation | Mapping & Responsibilities |
| :--- | :--- | :--- | :--- |
| **`ResultService.save_result_draft`** | `apps/results/services.py:28` | PostgreSQL RPC: `save_result_draft(...)` & `src/services/resultService.ts` | Row locks event result; recalculates $\text{Total} = \text{Grade} + \text{Position}$; manages entries and group participants. |
| **`ResultService.publish_result`** | `apps/results/services.py:137` | PostgreSQL RPC: `publish_result(...)` & `src/services/resultService.ts` | Validates entries > 0; sets status to `PUBLISHED`; generates active `point_ledger` records; invalidates cache. |
| **`ResultService.unpublish_result`** | `apps/results/services.py:224` | PostgreSQL RPC: `unpublish_result(...)` & `src/services/resultService.ts` | Reverts status to `DRAFT`; deactivates all ledger points (`is_active = false`); logs audit; invalidates cache. |
| **`ResultService.correct_published_result`**| `apps/results/services.py:268`| PostgreSQL RPC: `correct_published_result(...)` | Captures old vs new scores delta; replaces ledger entries; creates `RESULT_CORRECTED` audit; invalidates cache. |
| **`ChampionshipService.get_church_standings`** | `apps/championships/services.py:30` | PostgreSQL RPC / View: `get_church_standings(...)` & `src/services/championshipService.ts` | Sums active church ledger points; counts 1st/2nd/3rd/Grade A; executes 5-level tie-breaker; applies shared rank. |
| **`ChampionshipService.get_individual_standings`** | `apps/championships/services.py:125`| PostgreSQL RPC / View: `get_individual_standings(...)` | Sums active individual ledger points; supports category filter (`JUNIOR`/`SENIOR`); executes 5-level tie-breaker. |
| **`ChampionshipService.get_live_summary`** | `apps/championships/services.py:236`| PostgreSQL RPC: `get_live_summary(...)` | Returns event completion stats, podium top-3 churches, top-3 individuals, and latest 3 published scorecards. |
| **`CacheService`** | `zimrah/cache_service.py` | `src/services/cacheService.ts` + Upstash Redis | Generation-scoped keys (`zimrah:v{gen}:{ns}:{hash}`); `invalidate_all()` via Redis `INCR zimrah:cache_generation`. |
| **`AuditService` / `log_activity`** | `apps/audit/utils.py` | `src/services/auditService.ts` & DB Trigger | Stores timestamped immutable audit logs with JSON before/after state diff. |

---

## 4. Views & Routes Mapping

### Public Web Routes

| Django Route / View | Django URL Name | Target React Route | Target Component |
| :--- | :--- | :--- | :--- |
| `/` (`public_home_view`) | `public_home` | `/` | `src/pages/public/HomePage.tsx` |
| `/results/` (`public_results_list_view`) | `public_results_list` | `/results` | `src/pages/public/ResultsListPage.tsx` |
| `/results/<code/` (`public_result_detail_view`) | `public_result_detail`| `/results/:code` | `src/pages/public/ResultDetailPage.tsx` |
| `/championship/church/` (`public_church_championship_view`)| `public_church_championship` | `/championship/church` | `src/pages/public/ChurchChampionshipPage.tsx` |
| `/championship/individual/` (`public_individual_championship_view`)| `public_individual_championship`| `/championship/individual`| `src/pages/public/IndividualChampionshipPage.tsx` |
| `/search/` (`public_search_view`) | `public_search` | `/search` | `src/pages/public/SearchPage.tsx` |
| `/manifest.json` (`pwa_manifest_view`) | `pwa_manifest` | `/manifest.webmanifest` | `public/manifest.webmanifest` |
| `/sw.js` (`pwa_service_worker_view`)| `pwa_service_worker` | Generated Service Worker | Built via `vite-plugin-pwa` |

### Administrative Portal Routes

| Django Portal Route | Django URL Name | Target React Route | Target Component / Feature |
| :--- | :--- | :--- | :--- |
| `/portal/login/` | `portal_login` | `/portal/login` | `src/pages/admin/LoginPage.tsx` |
| `/portal/logout/` | `portal_logout` | Handled via AuthContext | `useAuth().signOut()` action |
| `/portal/dashboard/` | `portal_dashboard` | `/portal` or `/portal/dashboard` | `src/pages/admin/DashboardPage.tsx` |
| `/portal/churches/` | `portal_church_list` | `/portal/churches` | `src/pages/admin/churches/ChurchListPage.tsx` |
| `/portal/churches/add/` | `portal_church_add` | `/portal/churches/add` | `src/pages/admin/churches/ChurchFormPage.tsx` |
| `/portal/churches/<id>/` | `portal_church_detail` | `/portal/churches/:id` | `src/pages/admin/churches/ChurchDetailPage.tsx` |
| `/portal/churches/<id>/edit/` | `portal_church_edit` | `/portal/churches/:id/edit` | `src/pages/admin/churches/ChurchFormPage.tsx` |
| `/portal/participants/` | `portal_participant_list`| `/portal/participants` | `src/pages/admin/participants/ParticipantListPage.tsx` |
| `/portal/participants/add/` | `portal_participant_add` | `/portal/participants/add` | `src/pages/admin/participants/ParticipantFormPage.tsx` |
| `/portal/participants/<id>/`| `portal_participant_detail`| `/portal/participants/:id`| `src/pages/admin/participants/ParticipantDetailPage.tsx`|
| `/portal/participants/<id>/edit/`| `portal_participant_edit`| `/portal/participants/:id/edit`| `src/pages/admin/participants/ParticipantFormPage.tsx`|
| `/portal/participants/import/` | `portal_participant_import`| `/portal/participants/import`| `src/pages/admin/participants/ParticipantImportPage.tsx`|
| `/portal/events/` | `portal_event_list` | `/portal/events` | `src/pages/admin/events/EventListPage.tsx` |
| `/portal/events/add/` | `portal_event_add` | `/portal/events/add` | `src/pages/admin/events/EventFormPage.tsx` |
| `/portal/events/<id>/` | `portal_event_detail` | `/portal/events/:id` | `src/pages/admin/events/EventDetailPage.tsx` |
| `/portal/events/<id>/edit/` | `portal_event_edit` | `/portal/events/:id/edit` | `src/pages/admin/events/EventFormPage.tsx` |
| `/portal/registrations/` | `portal_registration_list`| `/portal/registrations` | `src/pages/admin/registrations/RegistrationListPage.tsx`|
| `/portal/registrations/add/` | `portal_registration_add` | `/portal/registrations/add` | `src/pages/admin/registrations/IndividualRegistrationPage.tsx`|
| `/portal/registrations/group-add/`| `portal_registration_group_add`| `/portal/registrations/group-add`| `src/pages/admin/registrations/GroupRegistrationPage.tsx`|
| `/portal/registrations/event/<id>/`| `portal_registration_event_detail`| `/portal/registrations/event/:id`| `src/pages/admin/registrations/EventRegistrationDetailPage.tsx`|
| `/portal/registrations/event/<id>/print/`| `portal_registration_event_print`| `/portal/registrations/event/:id/print`| `src/pages/admin/registrations/RosterPrintPage.tsx`|
| `/portal/results/` | `portal_result_list` | `/portal/results` | `src/pages/admin/results/ResultListPage.tsx` |
| `/portal/results/<id>/entry/` | `portal_result_entry` | `/portal/results/:id/entry` | `src/pages/admin/results/ResultEntryPage.tsx` |
| `/portal/results/<id>/preview/`| `portal_result_preview` | `/portal/results/:id/preview`| `src/pages/admin/results/ResultPreviewPage.tsx` |
| `/portal/results/<id>/correct/`| `portal_result_correct` | `/portal/results/:id/correct`| `src/pages/admin/results/ResultCorrectionPage.tsx` |
| `/portal/results/<id>/history/`| `portal_result_history` | `/portal/results/:id/history`| `src/pages/admin/results/ResultHistoryPage.tsx` |

---

## 5. Security & Authorization Mapping

| Django Mechanism | Supabase / Target Mechanism | Enforcement Details |
| :--- | :--- | :--- |
| `AbstractUser` + `role` | Supabase Auth + `user_profiles.role` | Roles: `SUPER_ADMIN`, `RESULT_ADMIN`, `PUBLISHER` |
| `@admin_required` | `ProtectedRoute` + RLS | Authenticated users with active profile |
| `@role_required(['SUPER_ADMIN'])` | RLS check & UI gate | Only `SUPER_ADMIN` can write churches, events, seed data |
| `@role_required(['SUPER_ADMIN', 'PUBLISHER'])` | RLS check & RPC gate | Only `SUPER_ADMIN` or `PUBLISHER` can call `publish_result`, `unpublish_result`, `correct_published_result` |
| `@role_required(['SUPER_ADMIN', 'RESULT_ADMIN'])` | RLS check & RPC gate | `RESULT_ADMIN` can manage participants, CSV imports, registrations, and enter draft results |
| `SecurityHeadersMiddleware` | `vercel.json` headers | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, etc. |
| `RateLimitMiddleware` | Upstash Redis Edge rate limiter | 600 req/min per IP sliding window on public and API routes |
| `AuditLog` | PostgreSQL `audit_logs` table | Inserted via RPC/triggers; non-deletable / non-editable via RLS |

---

## 6. Test Suite Mapping

| Django Test File | Total Tests | Target Vitest Suite | Key Scenarios Covered |
| :--- | :---: | :--- | :--- |
| `test_models.py` | 10 | `tests/unit/models.test.ts` | Unique constraints, string chest numbers, decimal scoring, group registration members, point ledger structure. |
| `test_phase2_admin.py` | 14 | `tests/integration/admin.test.ts` | Auth redirects, role-based gates, church CRUD, participant search, CSV import with UTF-8 BOM, registration integrity. |
| `test_phase3_results.py` | 12 | `tests/integration/results.test.ts` | Server score calculation ($\text{Total} = \text{Grade} + \text{Position}$), draft -> publish -> unpublish -> correct, atomic ledger, audit diff. |
| `test_phase5_public_and_championship.py` | 15 | `tests/integration/championship.test.ts` | 5-level tie-breaking, standard competition ranking, shared rank, live summary, public search, PWA endpoints, REST APIs. |
| `test_phase6_security_and_performance.py`| 7 | `tests/security/security.test.ts` | Unauthenticated portal block, draft result privacy, security headers, SQL injection immunity, generation-based cache invalidation. |
| **Total** | **58** | **58+ passing tests** | Complete reproducing test suite matching all existing assertions. |
