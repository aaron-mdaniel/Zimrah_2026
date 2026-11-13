# ZIMRAH 2026 – Environment Variables Specification

This document details the environment configuration required to run, test, and deploy the ZIMRAH 2026 platform.

---

## 1. Security Classification & Guardrails

| Scope | Security Rule | Where to Configure |
| :--- | :--- | :--- |
| **Client-Side (Browser Safe)** | Pre-fixed with `VITE_`. Bundled into JavaScript code. **Must never contain private keys, master tokens, or database passwords.** | Vercel Environment Variables (`Production`, `Preview`), local `.env.local` |
| **Server-Side (Privileged)** | Unprefixed. Available only to serverless functions, migration scripts, and backend tasks. **Never expose to the browser.** | Vercel Project Secrets, Supabase Dashboard, GitHub Action Secrets |

> [!CAUTION]
> Under no circumstances should `SUPABASE_SERVICE_ROLE_KEY` or database master passwords be prefixed with `VITE_` or included in frontend client bundles. Doing so compromises all database Row Level Security.

---

## 2. Client-Facing Environment Variables (Browser-Safe)

These variables are consumed by the Vite React application at build and runtime:

### `VITE_SUPABASE_URL`
- **Description**: The public HTTPS REST endpoint for your Supabase project.
- **Format**: `https://<project-ref>.supabase.co`
- **Example**: `https://xyzprojectref123.supabase.co`
- **Required**: Yes (defaults to mock fallback if unset in local development).
- **Security**: Publicly accessible.

### `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Description**: The public anonymous client API key (`anon` key).
- **Format**: JSON Web Token (JWT) starting with `eyJhbGci...`
- **Required**: Yes.
- **Security**: Safe for browser exposure. Public access is governed strictly by PostgreSQL Row Level Security (RLS) policies.

### `VITE_UPSTASH_REDIS_REST_URL`
- **Description**: The HTTPS REST endpoint of your Upstash Redis database for client-side distributed cache verification and edge invalidation.
- **Format**: `https://<instance-name>.upstash.io`
- **Example**: `https://flowing-orca-12345.upstash.io`
- **Required**: Optional (if omitted, `cacheService` gracefully falls back to high-speed in-memory LRU cache).
- **Security**: Public read URL with REST token authentication.

### `VITE_UPSTASH_REDIS_REST_TOKEN`
- **Description**: The REST access token for your Upstash Redis instance.
- **Format**: Alphanumeric token string (e.g. `AX...`)
- **Required**: Optional (used with `VITE_UPSTASH_REDIS_REST_URL`).

---

## 3. Server-Side Privileged Environment Variables

These variables are used exclusively in server-side scripts, database migrations, and administrative automation:

### `SUPABASE_SERVICE_ROLE_KEY`
- **Description**: The administrative service role secret key. Bypasses all Row Level Security policies.
- **Format**: JWT starting with `eyJhbGci...`
- **Required**: For server-side database administration, seed automation, and migration scripts only.
- **Security**: **EXTREMELY CONFIDENTIAL**. Never expose to frontend or commit to version control.

### `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
- **Description**: Privileged backend access tokens for Redis management tasks and webhooks.

### `DATABASE_URL`
- **Description**: PostgreSQL direct connection URI for migration utilities (`psycopg` / `psql`).
- **Format**: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
- **Required**: For executing schema migrations from command-line tools.

---

## 4. Configuration Template (`.env.example`)

```bash
# ==============================================================================
# ZIMRAH 2026 – PRODUCTION ENVIRONMENT VARIABLES
# ==============================================================================

# Supabase Public API (Vercel Frontend)
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...

# Upstash Redis Distributed Cache (Edge & Serverless Compatible)
VITE_UPSTASH_REDIS_REST_URL=https://<your-instance>.upstash.io
VITE_UPSTASH_REDIS_REST_TOKEN=AX...

# Server-Side / CI Secrets (DO NOT PRE-FIX WITH VITE_)
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
# DATABASE_URL=postgresql://postgres:password@host:5432/dbname
```

---

## 5. Secret Rotation Procedures

### 5.1 Supabase Anon Key Rotation
1. In Supabase Dashboard, navigate to **Project Settings > API**.
2. Click **Generate New Key** for the Anon key.
3. Update `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel (**Project Settings > Environment Variables**).
4. Trigger a new production deployment in Vercel to rebuild frontend assets.
5. Invalidate the old key after confirming the new deployment is live.

### 5.2 Upstash Redis Token Rotation
1. In the Upstash Console, navigate to your database and select **REST API > Read-Only Tokens**.
2. Generate a new token.
3. Update `VITE_UPSTASH_REDIS_REST_TOKEN` in Vercel.
4. Redeploy Vercel application.
5. Delete the revoked token in Upstash.
