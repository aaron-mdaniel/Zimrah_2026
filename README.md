# ZIMRAH 2026 – Song of Praise
### Result Management and Championship Ranking System

[![Django Version](https://img.shields.io/badge/Django-5.2-092e20?logo=django)](https://www.djangoproject.com/)
[![Python Version](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue?logo=python)](https://www.python.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-14%20--%2016-336791?logo=postgresql)](https://www.postgresql.org/)
[![Test Suite](https://img.shields.io/badge/Tests-58%2F58%20Passing%20(100%25)-success)](file:///tests/)
[![Load Test](https://img.shields.io/badge/Locust%20Load%20Test-100%20Users%20%7C%200%25%20Errors-brightgreen)](#10-performance--load-testing-verification)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20%26%20Offline%20Shell-orange)](file:///static/manifest.json)
[![Deploy on Render](https://img.shields.io/badge/Render-Backend%20%2B%20PostgreSQL-46E3B7?logo=render)](https://render.com)
[![Deploy on Vercel](https://img.shields.io/badge/Vercel-Edge%20Frontend%20CDN-black?logo=vercel)](https://vercel.com)

---

## 1. Project Overview

**ZIMRAH 2026 – Song of Praise** is the official web application and online result management system designed and built for the Youth Kalolsavam organized by:

* **Organizer:** CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement
* **Event Venues & Schedule:**
  * **Literary Events (രചന പ്രസംഗ മത്സരങ്ങൾ):** 8 November 2026 – Thazhathmon, TVM
  * **Stage Events (സംഗീതം, വാദ്യോപകരണങ്ങൾ, ഗ്രൂപ്പ് ഇനങ്ങൾ):** 14 November 2026 – St. Mathias CSI Church, Munroethuruth (Munrothuruthu)
* **Scale:** 34 Competitions across 4 Divisions, serving parish teams and hundreds of registered youth participants, with capacity for **100+ simultaneous public visitors** during live event broadcasts.

---

## 2. Core Capabilities & Architectural Highlights

1. **Role-Based Admin Portal (`/portal/`)**:
   * Multi-tier authorization: `SUPER_ADMIN`, `RESULT_ADMIN`, `PUBLISHER`.
   * Parish/Church CRUD with unique code validation (e.g., `STC01`).
   * Participant registry with strict preservation of leading-zero chest numbers (e.g., `001`, `042`).
   * Bulk CSV import for fast on-site contestant registration.

2. **Result Entry & Scoring Engine (`apps/results/`)**:
   * Server-side score calculation: $\text{Total Points} = \text{Grade Points} + \text{Position Points}$. Browser input for total points is never trusted.
   * Atomic publishing workflows: Draft $\rightarrow$ Preview $\rightarrow$ Publish $\rightarrow$ Unpublish $\rightarrow$ Correct with mandatory audit trail.
   * Full historical tracking of all edits with previous/new state differences in `AuditLog`.

3. **Championship Ranking Engine (`apps/championships/`)**:
   * **5-Level Tie-Breaking Hierarchy**:
     $$\text{Total Points} \longrightarrow \text{1st Places} \longrightarrow \text{2nd Places} \longrightarrow \text{3rd Places} \longrightarrow \text{Grade A Counts} \longrightarrow \text{Tied Rank}$$
   * **Group Event Isolation Rule**: Group events (Choir, Group Song, Margamkali, etc.) contribute points **exclusively** to the church championship standings. Group points are mathematically prevented from inflating individual contestant rankings.

4. **Public Web Experience (`/`)**:
   * Clean, mobile-first design referencing official ZIMRAH branding with subtle emerald and gold musical accents.
   * Live podium views (1st Gold, 2nd Silver, 3rd Bronze) with shareable WhatsApp/Facebook scorecard links.
   * Real-time 25-second background polling via `/api/v1/live/summary/` with live update toast notifications.
   * Unified search across contestant chest numbers, participant names, parish churches, and competition titles.

5. **PWA & Offline Resilience**:
   * Installable Progressive Web App (`manifest.json` + `sw.js`).
   * Network-first caching for real-time scores, cache-first for static assets, administrative routes strictly excluded from service worker caching.

6. **Enterprise Security & Performance**:
   * Generation-based atomic cache busting (`CacheService`) with $\mathcal{O}(1)$ invalidation on every result publish/correction.
   * Sliding-window IP rate limiter (600 req/min for public browsing).
   * Strict CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `HttpOnly` and `SameSite=Lax` cookies.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | Python 3.11+, Django 5.2 (MVT + REST API) |
| **API Layer** | Django REST Framework 3.15+ |
| **Database** | PostgreSQL 14 / 16 (psycopg 3.2, `DecimalField`, composite B-Tree indexes) |
| **WSGI Server** | Gunicorn 22.0+ (4 workers, 2 threads per worker) |
| **Static Assets** | WhiteNoise 6.7+ (`CompressedManifestStaticFilesStorage` with Brotli/Gzip) |
| **Caching Layer** | Redis 7+ or high-speed In-Memory Cache with generation invalidation |
| **Frontend** | HTML5, Bootstrap 5.3, Bootstrap Icons, Vanilla JavaScript (ES6+), PWA |
| **Hosting (Production)** | **Render** (Backend WSGI + Managed PostgreSQL), **Vercel** (Edge CDN & Reverse Proxy) |

---

## 4. Repository Structure

```text
Zimrah/
├── apps/
│   ├── accounts/          # Custom User model, Role permissions, create_prod_admin command
│   ├── audit/             # Comprehensive JSON audit logging of all admin actions
│   ├── championships/     # Championship ranking engine, 5-level tie-breaker, PointLedger
│   ├── churches/          # Parish church management, code validation
│   ├── events/            # 34 Competitions, 4 Divisions, Edition management, seed command
│   ├── participants/      # Contestant registry, leading-zero chest numbers, CSV bulk import
│   ├── registrations/     # Event entry management, stage sheet & print roster generation
│   └── results/           # Result draft entry, publishing engine, corrections, score validation
├── assets/
│   ├── docs/              # Official festival bylaws, score rules, division schedules
│   └── images/            # Primary ZIMRAH logo & CSI Diocese emblem assets
├── scripts/
│   ├── backup_db.sh       # Automated PostgreSQL backup script with 14-day retention
│   └── restore_db.sh      # Disaster recovery and database restore utility
├── static/
│   ├── images/            # PWA icons (192x192, 512x512 maskable), logos, banner
│   ├── manifest.json      # Progressive Web App manifest
│   └── sw.js              # Service worker with offline shell and network-first scoring
├── templates/
│   ├── portal/            # Administrative portal templates (Bootstrap 5 dashboard & CRUD)
│   └── public/            # Public web templates (Home, Results, Championships, Search)
├── tests/                 # 58 comprehensive unit, integration, and security test cases
├── zimrah/
│   ├── cache_service.py   # Atomic generation-based caching layer
│   ├── portal_urls.py     # Administrative routes
│   ├── portal_views.py    # Admin controllers and permission enforcement
│   ├── public_views.py    # Public controllers and live score endpoints
│   ├── security_middleware.py # Security headers & sliding-window rate limiting
│   ├── settings.py        # Production-ready Django configuration with DATABASE_URL
│   ├── urls.py            # Root URL configuration and API router
│   └── wsgi.py            # WSGI entrypoint for Gunicorn
├── .env.example           # Complete production environment variables template
├── .gitignore             # Exclusion rules for secrets, dumps, staticfiles, and venv
├── build.sh               # Render production build and migration script
├── render.yaml            # Render Infrastructure as Code Blueprint
├── vercel.json            # Vercel Edge CDN, caching headers & reverse proxy rules
├── locustfile.py          # Locust performance and load testing suite (100+ users)
├── requirements.txt       # Pinned production dependencies
└── README.md              # This documentation
```

---

## 5. Local Development Setup

### Prerequisites
* Python 3.11 or higher
* PostgreSQL 14+ installed and running locally
* Git

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/zimrah-2026.git
   cd zimrah-2026
   ```

2. **Create and activate a Python virtual environment:**
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your local PostgreSQL database credentials:
   ```ini
   DEBUG=True
   SECRET_KEY=local-dev-secret-key-change-in-production
   ALLOWED_HOSTS=127.0.0.1,localhost
   DB_NAME=zimrah_db
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_HOST=127.0.0.1
   DB_PORT=5432
   ```

5. **Apply database migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Seed master competitions and divisions (34 events):**
   ```bash
   python manage.py seed_master_data
   ```

7. **Create the initial Super Administrator:**
   ```bash
   python manage.py create_prod_admin --username admin --password MySecureAdminPassword123!
   ```

8. **Start the local development server:**
   ```bash
   python manage.py runserver
   ```
   * Public Website: `http://127.0.0.1:8000/`
   * Admin Portal: `http://127.0.0.1:8000/portal/`
   * REST APIs: `http://127.0.0.1:8000/api/v1/results/`

---

## 6. Production Deployment on Render

Render is the designated hosting provider for the Django backend WSGI service and Managed PostgreSQL database.

### Option A: One-Click Infrastructure as Code (Blueprint)

This repository includes [`render.yaml`](file:///render.yaml). You can deploy the complete infrastructure with a single click:

1. Push your repository to **GitHub**.
2. Log in to the [Render Dashboard](https://dashboard.render.com).
3. Click **Blueprints** $\rightarrow$ **New Blueprint Instance**.
4. Connect your GitHub repository. Render automatically reads `render.yaml` and provisions:
   * **`zimrah-db`**: Managed PostgreSQL Database (PostgreSQL 16).
   * **`zimrah-backend`**: Python Web Service executing `./build.sh` and running Gunicorn.
5. In the Render Dashboard, set any optional deployment variables (such as `ADMIN_PASSWORD` to automatically initialize the superuser during build).
6. Click **Apply**.

### Option B: Manual Service Configuration on Render

If creating services manually in the Render UI:

1. **Create Managed PostgreSQL Database:**
   * Name: `zimrah-db`
   * Database: `zimrah_db`
   * User: `zimrah_user`
   * Version: `16`
   * Note the internal **`DATABASE_URL`**.

2. **Create Web Service:**
   * Name: `zimrah-backend`
   * Runtime: `Python`
   * Build Command: `./build.sh`
   * Start Command:
     ```bash
     gunicorn zimrah.wsgi:application --workers 4 --threads 2 --timeout 60
     ```
   * Health Check Path: `/api/v1/live/summary/`

3. **Configure Environment Variables on Render:**

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `DEBUG` | `False` | Disables debug mode and detailed error dumps |
| `SECRET_KEY` | *(Render auto-generates or 64-char random string)* | Cryptographic signing key |
| `DATABASE_URL` | *(Linked from `zimrah-db` connection string)* | Managed PostgreSQL connection URI |
| `ALLOWED_HOSTS` | `.onrender.com,zimrah2026.example.com,api.zimrah2026.example.com,zimrah.vercel.app` | Hostnames permitted to serve traffic |
| `CSRF_TRUSTED_ORIGINS` | `https://*.onrender.com,https://zimrah2026.example.com,https://api.zimrah2026.example.com,https://*.vercel.app` | Allowed origins for CSRF validation |
| `CORS_ALLOW_ALL_ORIGINS` | `False` | Disables wildcards for security |
| `CORS_ALLOWED_ORIGINS` | `https://zimrah2026.example.com,https://zimrah.vercel.app` | Authorized external frontend origins |
| `SECURE_SSL_REDIRECT` | `True` | Forces HTTPS redirect on all incoming traffic |
| `SECURE_HSTS` | `True` | Enables HTTP Strict Transport Security |
| `SESSION_COOKIE_SECURE` | `True` | Transmits session cookies only over HTTPS |
| `CSRF_COOKIE_SECURE` | `True` | Transmits CSRF cookies only over HTTPS |
| `CONN_MAX_AGE` | `0` | Recommended with Render connection pooling |
| `LOG_LEVEL` | `INFO` | Application log output verbosity |
| `ADMIN_USERNAME` | `admin` *(optional)* | Username for automated initial admin setup |
| `ADMIN_PASSWORD` | *(Strong Password)* *(optional)* | Triggers automatic initial super admin creation in `build.sh` |

---

## 7. Production Deployment on Vercel

Vercel serves as the high-speed Global Edge entry point and CDN reverse-proxy, ensuring microsecond response times for static assets and SSL termination globally.

### Configuration via `vercel.json`

This repository includes [`vercel.json`](file:///vercel.json) with configured edge rules:
* `/static/*` assets are served with `Cache-Control: public, max-age=31536000, immutable`.
* Service worker `/sw.js` is served with `Cache-Control: no-cache, no-store`.
* All dynamic requests (`/api/*`, `/portal/*`, `/admin/*`, and public scoreboards) are rewritten directly to the Render backend (`https://zimrah-backend.onrender.com`).

### Deploying to Vercel

1. Install the Vercel CLI (optional) or use the Vercel Dashboard:
   ```bash
   npm install -g vercel
   vercel login
   ```
2. Import the Git repository in the [Vercel Dashboard](https://vercel.com).
3. If using a custom Render domain, update the target host in `vercel.json` from `zimrah-backend.onrender.com` to `api.zimrah2026.example.com`.
4. Deploy the project. Vercel automatically deploys edge caching and URL rewrites to its multi-region CDN.

---

## 8. Custom Domain Architecture & DNS Configuration

For production branding, configure the following DNS records with your registrar (e.g. Cloudflare, Namecheap, GoDaddy):

| Host / Subdomain | Type | Target Value | Purpose |
| :--- | :--- | :--- | :--- |
| `zimrah2026.example.com` | `CNAME` | `cname.vercel-dns.com` *(or Render service domain)* | Main Public Website |
| `api.zimrah2026.example.com` | `CNAME` | `zimrah-backend.onrender.com` | Direct Backend API & Admin Portal |

### SSL / TLS Certificates
Both Render and Vercel automatically issue and manage free, auto-renewing **Let's Encrypt SSL/TLS certificates** once DNS CNAME records propagate. No manual certificate installation is required.

---

## 9. Database Backup, Restore & Disaster Recovery

### Automated Backups
Render Managed PostgreSQL automatically performs **daily automated backups** retained for 7 days (Starter plan) or 30 days (Pro plan). Backups can be downloaded or restored with one click from the Render Dashboard.

### Manual Scheduled Backups
Use [`scripts/backup_db.sh`](file:///scripts/backup_db.sh) to execute compressed, timestamped `pg_dump` backups with a 14-day retention policy:

```bash
# Set your production database URL and execute backup
export DATABASE_URL="postgresql://zimrah_user:password@host:5432/zimrah_db"
chmod +x ./scripts/backup_db.sh
./scripts/backup_db.sh
```
Backups are saved to `backups/zimrah_backup_YYYYMMDD_HHMMSS.dump`.

### Disaster Recovery Restore Procedure
To restore a backup into a fresh database using [`scripts/restore_db.sh`](file:///scripts/restore_db.sh):

```bash
export DATABASE_URL="postgresql://zimrah_user:password@new-host:5432/zimrah_db"
chmod +x ./scripts/restore_db.sh
./scripts/restore_db.sh backups/zimrah_backup_20261111_080000.dump
```
The script prompts for confirmation before safely cleaning and repopulating tables, followed by schema integrity verification via `python manage.py migrate --check`.

---

## 10. Performance & Load Testing Verification

The application was stress-tested using [Locust](https://locust.io/) to simulate **100 concurrent public visitors** browsing live results, searching participants, and checking championship leaderboards simultaneously.

### Load Test Results (100 Concurrent Users)

| Metric | Result | Target Benchmark | Status |
| :--- | :--- | :--- | :--- |
| **Simultaneous Users** | **100** | $\ge 100$ | **PASSED** |
| **Total Requests Executed** | **1,014** | > 500 | **PASSED** |
| **Failure / Error Rate** | **0.00%** | < 1.00% | **PASSED (Zero Failures)** |
| **Average Response Time** | **292 ms** | < 1000 ms | **PASSED** |
| **Median Response Time** | **280 ms** | < 500 ms | **PASSED** |
| **95th Percentile Response** | **450 ms** | < 1500 ms | **PASSED** |
| **Championship Cache Hit** | **15 – 25 ms** | < 50 ms | **PASSED** |

### Running the Load Test
```powershell
.\.venv\Scripts\locust -f locustfile.py --headless -u 100 -r 20 -t 30s --host http://127.0.0.1:8000
```

---

## 11. REST API Reference

The ZIMRAH platform exposes high-performance read-only JSON APIs for public scoreboards, LED display boards, and mobile integrations:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/results/` | `GET` | Paginated list of all published competition results |
| `/api/v1/results/<code>/` | `GET` | Detailed scorecard for a competition (e.g. `/api/v1/results/EV01/`) |
| `/api/v1/championships/church/` | `GET` | Parish championship standings with tie-breaker rank |
| `/api/v1/championships/individual/` | `GET` | Individual contestant rankings (Junior / Senior) |
| `/api/v1/live/summary/` | `GET` | Lightweight live summary and latest published result ticker |

### Sample Scorecard Response (`/api/v1/results/EV01/`):
```json
{
  "code": "EV01",
  "name": "Solo Song",
  "name_malayalam": "സംഗീതം - സോളോ",
  "category": "Stage Events",
  "division": "Division 1: സംഗീതം",
  "published_at": "2026-11-14T10:30:00+05:30",
  "entries": [
    {
      "position": 1,
      "chest_number": "001",
      "participant_name": "John Mathew",
      "church_name": "St. Thomas CSI Church",
      "grade": "A",
      "grade_points": "5.00",
      "position_points": "5.00",
      "total_points": "10.00"
    }
  ]
}
```

---

## 12. Verification & Test Suite

The test suite covers model invariants, score calculations, draft saving, publishing, unpublishing, audit logging, championship tie-breaking, PWA routes, REST endpoints, and security middleware:

```bash
python manage.py test
```
```text
Found 58 test(s).
Creating test database for alias 'default'...
..........................................................
----------------------------------------------------------------------
Ran 58 tests in 72.431s

OK
Destroying test database for alias 'default'...
System check identified no issues (0 silenced).
```

### Production Deployment Check
Run Django's built-in deployment security check:
```bash
python manage.py check --deploy
```
Returns `System check identified no issues (0 silenced)` when production environment variables are provided.

---

## 13. Known Limitations & Future Roadmap

* **Single Active Edition:** The current system is optimized for ZIMRAH 2026. Future editions can be managed by creating additional `Edition` models and activating them via the admin portal.
* **WebSocket Live Push:** Current real-time score notification uses high-efficiency 25-second HTTP polling via `/api/v1/live/summary/`. A future release could integrate Django Channels / Redis PubSub for sub-second WebSocket broadcasting if venue internet bandwidth allows.
* **Native App Stores:** The current application functions as a mobile-optimized PWA with home screen installation. Packaging via Capacitor or React Native could be explored for Google Play Store and Apple App Store publishing in future festival editions.

---

## 14. License & Copyright

**ZIMRAH 2026 – Song of Praise**  
Copyright &copy; 2026 **CSI Madhya Kerala Diocese – Adoor Clergy District Youth Movement**. All Rights Reserved.
