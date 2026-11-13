# ZIMRAH 2026 – Production Deployment Guide
**CSI Madhya Kerala Diocese, Adoor Clergy District Youth Movement**
*Target Architecture: React (Vite) + Supabase PostgreSQL + Upstash Redis + Vercel + GitHub*

---

## 1. Overview & Architecture

ZIMRAH 2026 is an enterprise-grade result management and competition ranking platform migrated from Django to a modern serverless, cloud-native stack:
- **Frontend**: React 18, TypeScript (strict), Vite 6, Tailwind CSS, shadcn/ui, TanStack Query, Vite PWA (Workbox).
- **Backend & Database**: Supabase PostgreSQL 15+ with Row Level Security (RLS), atomic stored procedures (RPCs), and transactional audit logging.
- **Edge Caching**: Upstash Redis HTTP REST API with $\mathcal{O}(1)$ generation-based cache busting and PostgreSQL Transactional Outbox invalidation triggers.
- **Hosting & Edge Delivery**: Vercel Serverless Platform with SPA routing, global CDN, and strict security headers.
- **Source Control & CI/CD**: GitHub with automated linting, type-checking, and preview deployments.

---

## 2. Step 1: Source Control & GitHub Setup

1. **Repository**: Ensure all production code is pushed to the primary GitHub repository:
   ```bash
   git remote -v
   # origin https://github.com/aaron-mdaniel/Zimrah_2026.git
   ```
2. **Branch Protection**: Configure branch protection rules on `main`:
   - Require pull request before merging.
   - Require status checks to pass before merging (`type-check`, `lint`, `test`).
   - Require linear commit history.

---

## 3. Step 2: Supabase Production Project Provisioning

1. **Create Supabase Project**:
   - Region: Select closest region (e.g., `ap-south-1` Mumbai) for minimum latency.
   - Set strong database password and securely record reference ID.
2. **Execute Database Migrations**:
   Execute migrations in sequential order using the Supabase CLI or SQL Editor:
   ```bash
   # Using Supabase CLI:
   supabase db push
   ```
   Or run the 17 migration files sequentially from `supabase/migrations/`:
   - `001_initial_schema.sql` (Extensions, Editions)
   - `002_profiles.sql` (User profiles & RBAC roles)
   - `003_churches.sql` (Parish churches registry)
   - `004_participants.sql` (Contestants & string chest numbers)
   - `005_events.sql` (Competitions, divisions & categories)
   - `006_registrations.sql` (Individual & group registrations)
   - `007_results.sql` (Results & marks tables)
   - `008_championships.sql` (Point ledger table)
   - `009_audit.sql` (Immutable audit logging)
   - `010_triggers.sql` (Auto-timestamps)
   - `011_indexes.sql` (Composite indexes)
   - `012_security_rls.sql` (Row Level Security & RBAC enforcement)
   - `013_master_data_enhancements.sql` (CSV bulk import RPC)
   - `014_registrations_constraints_and_rpc.sql` (Registration RPCs & collision triggers)
   - `015_result_management_and_rpc.sql` (Result lifecycle RPCs & server scoring)
   - `016_championship_engine_and_rpc.sql` (5-level tie-breaking & standings RPCs)
   - `017_cache_outbox_and_performance_tuning.sql` (Transactional outbox & GIN trigram indexes)
3. **Verify Row Level Security**:
   Ensure RLS is enabled and forced on all tables:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```
4. **Seed Production Master Data**:
   Execute `supabase/seed.sql` to initialize official festival categories, divisions, and baseline configuration.
5. **Configure Authentication Settings**:
   - Site URL: `https://zimrah.vercel.app` (or custom domain).
   - Redirect URLs: `https://zimrah.vercel.app/**`, `https://zimrah.vercel.app/portal/dashboard`.
   - Disable email signup if public self-registration is prohibited (Admin-invite only).

---

## 4. Step 3: Upstash Redis Provisioning

1. **Create Redis Database**:
   - Cloud: AWS.
   - Region: Same region as Supabase (e.g., `ap-south-1`).
   - Eviction: No eviction (data expires via TTL).
2. **Retrieve REST Credentials**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. **Initialize Cache Generation**:
   The cache service automatically syncs with `cache_generation_state` in PostgreSQL. To manually initialize:
   ```bash
   curl -X POST "$UPSTASH_REDIS_REST_URL/set/zimrah:cache_generation/1" \
     -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
   ```

---

## 5. Step 4: Vercel Production Deployment

### 5.1 Project Configuration
1. Import GitHub repository into Vercel.
2. Framework Preset: `Vite`.
3. Root Directory: `./`.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Install Command: `npm install`.

### 5.2 Environment Variables Configuration
In the Vercel Project Dashboard (**Settings > Environment Variables**), set:

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Production, Preview | Supabase Project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | Supabase Anon / Publishable Public Key |
| `VITE_UPSTASH_REDIS_REST_URL` | Production, Preview | Upstash Redis REST URL (`https://<ref>.upstash.io`) |
| `VITE_UPSTASH_REDIS_REST_TOKEN` | Production, Preview | Upstash Redis REST Token |

> [!CAUTION]
> Never set `SUPABASE_SERVICE_ROLE_KEY` with the `VITE_` prefix. Service role secrets must NEVER be bundled into frontend client assets.

### 5.3 Verify `vercel.json` Routing & Headers
Ensure `vercel.json` contains SPA rewrite and security headers:
- Rewrites: `source: "/(.*)"` → `destination: "/index.html"`.
- Static asset immutable caching for `/assets/(.*)`.
- No-cache header for `/sw.js`.
- Security Headers: HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, CSP.

---

## 6. Step 5: Custom Domain Configuration

1. **DNS Setup**:
   - In Vercel (**Settings > Domains**), add custom domain (e.g., `results.zimrah.org` or `zimrah.org`).
   - Add CNAME record: `cname.vercel-dns.com` or Apex A record: `76.76.21.21`.
2. **SSL / TLS Certificate**:
   - Vercel automatically generates and provisions Let's Encrypt SSL/TLS certificates.
3. **Update Supabase Redirect URLs**:
   - Add custom domain to Supabase Auth Allowlist: `https://your-custom-domain.com/**`.

---

## 7. Step 6: Post-Deployment Smoke Test & Sanity Audit

Execute the following verification sequence immediately following deployment:
1. **Public Homepage**: Verify banner, live statistics counter, top-3 podium, and venue listings load.
2. **Competitions Catalog**: Filter by divisions and open Event Details modal.
3. **Leaderboards**: Check `/championship/church` and `/championship/individual` for correct point tallies and tie-break ranks.
4. **Result Scorecard**: Open published scorecard, verify WhatsApp share link and print certificate view (`Ctrl+P` / `Cmd+P`).
5. **PWA Installation**: Verify browser install prompt appears and application shell functions offline.
6. **Admin Login**: Access `/login`, sign in as `SUPER_ADMIN`, and confirm `/portal/dashboard` displays real live counts.
7. **Audit Log Trail**: Check `/portal/audit` to ensure admin sign-in is recorded in the PostgreSQL immutable audit log.
