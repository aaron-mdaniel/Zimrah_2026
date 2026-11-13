# ZIMRAH 2026 – Database Backup & Disaster Recovery Guide

This guide establishes the backup standards, retention protocols, and recovery procedures for the ZIMRAH 2026 Supabase PostgreSQL database.

---

## 1. Backup Strategies & Protocols

### 1.1 Automated Managed Backups (Supabase PITR)
- **Point-in-Time Recovery (PITR)**: Enabled for production, providing continuous WAL-level archiving allowing restoration down to the second.
- **Daily Snapshots**: Automated daily logical snapshots retained for 30 days.

### 1.2 Manual Pre-Deployment Backups (`pg_dump`)
Prior to executing any schema migration or major administrative festival batch, a manual logical dump must be taken:

```bash
# Set database connection parameters
export PGPASSWORD="your_secure_password"
HOST="db.<project-ref>.supabase.co"
USER="postgres"
DATABASE="postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Full logical backup (Schema + Data)
pg_dump -h $HOST -U $USER -d $DATABASE \
  --format=custom \
  --file="zimrah_prod_full_${TIMESTAMP}.dump"

# 2. Schema-only backup (DDL)
pg_dump -h $HOST -U $USER -d $DATABASE \
  --schema-only \
  --file="zimrah_prod_schema_${TIMESTAMP}.sql"

# 3. Data-only backup (Inserts)
pg_dump -h $HOST -U $USER -d $DATABASE \
  --data-only \
  --column-inserts \
  --file="zimrah_prod_data_${TIMESTAMP}.sql"
```

---

## 2. Backup Verification Protocols

A backup is not considered valid until verified:

1. **Format Validation**: Ensure `pg_restore --list zimrah_prod_full_<TIMESTAMP>.dump` lists all 15 public tables, views, and functions.
2. **String Chest Number Integrity (ADR-005)**:
   Verify leading zeros are preserved in the backup:
   ```sql
   SELECT chest_number FROM public.participants WHERE chest_number LIKE '0%' LIMIT 5;
   -- Must return string with leading zeroes (e.g., '001', '010', '042')
   ```
3. **Decimal Precision Integrity**:
   Verify points and ledger values are recorded as `NUMERIC(5,2)`:
   ```sql
   SELECT total_points FROM public.result_entries WHERE total_points % 1 != 0 LIMIT 5;
   -- Preserves exact fractions (e.g. 5.75, 12.50) without float rounding drift
   ```
4. **Point Ledger & Standings Reconciliation**:
   ```sql
   SELECT 
       (SELECT COUNT(*) FROM public.event_results WHERE status = 'PUBLISHED') AS published_results,
       (SELECT COUNT(*) FROM public.point_ledger WHERE is_active = TRUE) AS active_ledger_entries;
   ```

---

## 3. Restoration & Disaster Recovery Procedure

If a disaster or destructive corruption occurs, follow this sequence:

### Step 1: Isolate Application
Immediately put the public frontend in maintenance mode or stop live results updates by toggling the Vercel maintenance header:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [{ "key": "Retry-After", "value": "300" }]
    }
  ]
}
```

### Step 2: Database Restoration
```bash
# Terminate existing connections
psql -h $HOST -U $USER -d $DATABASE -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$DATABASE' AND pid <> pg_backend_pid();"

# Restore from verified custom-format dump
pg_restore -h $HOST -U $USER -d $DATABASE \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "zimrah_prod_full_${TIMESTAMP}.dump"
```

### Step 3: Post-Restoration Invariant Verification
Run the automated verification suite to validate restored state:
```bash
python scripts/test_production_e2e.py
```

### Step 4: Purge Distributed Cache
Increment the global cache generation to flush all edge stale keys across Upstash Redis:
```bash
curl -X POST "$UPSTASH_REDIS_REST_URL/incr/zimrah:cache_generation" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```
Reopen public traffic once verification succeeds.
