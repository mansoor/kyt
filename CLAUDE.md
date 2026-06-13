# Know Your Tesla (KYT) — Developer Guide

Self-hosted Tesla data logger replacing TeslaMate + Grafana with a modern web app.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 async (asyncpg), Alembic, APScheduler |
| Database | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3, Recharts, React-Leaflet |
| Proxy | Caddy 2 |
| Broker | Mosquitto (MQTT) |

## Running locally

```bash
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY and ENCRYPTION_KEY (32+ chars each)

docker compose up -d
open http://localhost
# Login: admin@kyt.local / changeme (set via INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD)
```

## Development (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
# Backend: uvicorn --reload on :8000
# Frontend: Vite HMR on :5173 (proxied through Caddy on :80)
```

## Running tests

```bash
# From backend source dir, using the backend Docker image (all deps available):
docker run --rm \
  -v "$(pwd)/backend:/app" \
  -e DATABASE_URL="postgresql+asyncpg://x:x@localhost/x" \
  -e SECRET_KEY="test-secret-key-at-least-32-chars-long!" \
  -e ENCRYPTION_KEY="test-encryption-key-32-chars-ok!" \
  -w /app --user root \
  teslamate-rebuild-backend \
  sh -c "pip install pytest pytest-asyncio --quiet --root-user-action=ignore 2>/dev/null && python -m pytest tests/ -v"
```

Tests use `httpx.AsyncClient` with mocked DB and auth — no real Postgres needed.

## Project layout

```
backend/
  routers/       # FastAPI routers (one file per feature area)
  models/        # SQLAlchemy ORM models
  services/      # Business logic (auth, poller, Tesla OAuth/API, encryption)
  migrations/    # Alembic migration versions
  scripts/       # CLI tools (import_teslamate.py)
  tests/         # pytest suite

frontend/src/
  api/           # Axios API clients (one file per backend area)
  components/    # Shared UI (AppShell, KpiCard, ProtectedRoute)
  pages/         # One directory per route
  router/        # React Router config
  store/         # Zustand auth store
```

## Key gotchas

### PostgreSQL column casing
The `drives.consumption_kWh` column has a mixed-case name (created by Alembic with `sa.Column("consumption_kWh", ...)`). PostgreSQL requires double-quoting mixed-case identifiers in raw SQL:

```sql
-- ✅ correct
SELECT d."consumption_kWh" AS consumption_kwh FROM drives d

-- ❌ wrong — PostgreSQL folds to lowercase, column not found
SELECT d.consumption_kWh FROM drives d
```

All routers alias this to lowercase (`AS consumption_kwh`) and access via `r["consumption_kwh"]`.

### Token encryption
Tesla OAuth tokens are stored encrypted in `tesla_tokens` using Fernet with a SHA-256 derived key from `ENCRYPTION_KEY`. Losing this key makes stored tokens unreadable — the user would need to re-authenticate.

### Poller state machine
`services/poller.py` runs an `AsyncIOScheduler` with per-car polling. States and intervals:

| State | Poll interval |
|---|---|
| asleep | 900s |
| online | 60s |
| driving | 5s |
| charging | 30s |
| updating | 60s |

The car transitions to `asleep` after 15 minutes of idle `online` state.

### Charge location coordinates
`charging_processes` has no lat/lng columns — coordinates are retrieved from the first `position` record during each charge window. The `addresses` table also has no coordinates; it stores only text fields from reverse geocoding.

### TeslaMate import
```bash
# Dry run (no writes) — shows record counts
docker compose exec backend python scripts/import_teslamate.py \
  --src "postgresql://teslamate:teslamate@old-host:5432/teslamate" \
  --dest "postgresql://teslamate:teslamate@db:5432/teslamate" \
  --dry-run

# Real import (sample 1-in-5 positions for speed)
docker compose exec backend python scripts/import_teslamate.py \
  --src "postgresql://..." --dest "postgresql://..."
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | asyncpg URL: `postgresql+asyncpg://user:pass@host/db` |
| `SECRET_KEY` | ✅ | JWT signing key, ≥32 chars |
| `ENCRYPTION_KEY` | ✅ | Tesla token encryption key, ≥32 chars |
| `TESLA_CLIENT_ID` | For live data | From developer.tesla.com |
| `TESLA_CLIENT_SECRET` | For live data | From developer.tesla.com |
| `TESLA_REDIRECT_URI` | For live data | e.g. `https://yourdomain.com/tesla/callback` |
| `INITIAL_ADMIN_EMAIL` | Optional | Default: `admin@kyt.local` |
| `INITIAL_ADMIN_PASSWORD` | Optional | Default: `changeme` — **change this** |
| `MQTT_HOST` | Optional | Default: `mosquitto` |
| `MQTT_PORT` | Optional | Default: `1883` |
| `LOG_LEVEL` | Optional | Default: `INFO` |

## API overview

| Prefix | File | Description |
|---|---|---|
| `/api/auth` | `routers/auth.py` | JWT login/refresh/logout, `/me` |
| `/api/public` | `routers/public.py` | Unauthenticated charge level widget |
| `/api/tesla` | `routers/tesla.py` | OAuth flow, vehicle sync, poller status |
| `/api/dashboard` | `routers/dashboard.py` | Summary: vehicles, 7-day KPIs, activity |
| `/api/drives` | `routers/drives.py` | List, detail, positions, CSV export |
| `/api/charges` | `routers/charges.py` | List, detail, readings, CSV export |
| `/api/analytics` | `routers/analytics.py` | Efficiency, charging stats, vampire drain, timeline |
| `/api/battery` | `routers/vehicle.py` | Battery health / degradation |
| `/api/locations` | `routers/vehicle.py` | All drive + charge map pins |
| `/api/geofences` | `routers/vehicle.py` | CRUD |
| `/api/updates` | `routers/vehicle.py` | Software update log |
