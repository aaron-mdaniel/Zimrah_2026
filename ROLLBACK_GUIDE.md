# ZIMRAH 2026 – Production Rollback Strategy & Incident Guide

This guide provides procedures to execute safe rollbacks for both frontend application deployments and backend database migrations in the event of an incident during ZIMRAH 2026.

---

## 1. Rollback Matrix & Decision Framework

| Incident Level | Scenario | Action Required | Max Recovery Time |
| :--- | :--- | :--- | :--- |
| **Level 1 (UI / Frontend Bug)** | Styling defect, broken link, or non-critical UI rendering issue on public pages. | Instant Vercel Rollback to previous deployment. | < 2 minutes |
| **Level 2 (Caching Desync)** | Stale leaderboard or scorecard scores displayed after an admin publication. | Increment Upstash Redis generation token (`INCR zimrah:cache_generation`). | < 30 seconds |
| **Level 3 (Database / Schema Failure)** | Erroneous migration, broken RPC constraint, or schema regression. | Point-in-time recovery (PITR) or dump restoration. | < 15 minutes |

---

## 2. Frontend Rollback Procedures (Vercel)

### Option A: Instant Rollback via Vercel Dashboard (Fastest)
1. Navigate to **Vercel Dashboard > zimrah-2026 > Deployments**.
2. Locate the last known stable deployment.
3. Click the three dots menu (`...`) and select **Instant Rollback**.
4. Confirm the rollback. Vercel immediately points the production domain (`zimrah.vercel.app` or custom domain) to the previous immutable deployment artifact without rebuilding.

### Option B: Rollback via Vercel CLI
```bash
# List recent deployments
npx vercel ls

# Assign domain alias to the stable deployment URL
npx vercel alias set <stable-deployment-url>.vercel.app zimrah.vercel.app
```

---

## 3. Database Rollback Procedures (Supabase)

### 3.1 Non-Destructive RPC Reversions
If an issue was introduced by an updated PostgreSQL function or RPC (e.g. `get_church_standings` or `save_result_draft`):
1. Re-apply the previous migration file from `supabase/migrations/` using `psql` or the Supabase SQL Editor.
2. Verify RPC functionality with the automated test suite:
   ```bash
   python scripts/test_results.py
   python scripts/test_championships.py
   ```

### 3.2 Full Database Snapshot Restoration
If data corruption occurred:
1. Restore from the pre-deployment dump created prior to the release (refer to [`DATABASE_BACKUP_GUIDE.md`](file:///c:/Users/AARON/Downloads/Zimrah/DATABASE_BACKUP_GUIDE.md)).
2. Execute the verification test:
   ```bash
   python scripts/test_production_e2e.py
   ```

---

## 4. Cache Invalidation Following Any Rollback

Whenever any frontend or backend rollback occurs, the distributed cache must be purged to prevent clients from observing mismatched schemas or stale calculation outputs:

```bash
# Trigger generation increment via Upstash REST API
curl -X POST "$UPSTASH_REDIS_REST_URL/incr/zimrah:cache_generation" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```
Or execute the PostgreSQL RPC:
```sql
SELECT public.invalidate_cache_generation('ROLLBACK_PURGE');
```

---

## 5. Post-Rollback Incident Template

Following resolution, document the incident:
```markdown
# Incident Post-Mortem: [INCIDENT-ID]
- **Date & Time**: YYYY-MM-DD HH:MM UTC
- **Severity**: Level 1 / Level 2 / Level 3
- **Root Cause**: [Brief description of what caused the rollback]
- **Resolution**: [Rollback method used]
- **Downtime Duration**: [Minutes of degraded performance or downtime]
- **Preventative Action**: [Testing or guardrail added to prevent recurrence]
```
