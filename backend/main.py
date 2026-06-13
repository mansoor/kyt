import logging
import subprocess
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from config import settings

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("teslamate")

# Shared limiter instance — imported by routers for per-endpoint limits
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


def run_migrations() -> None:
    logger.info("Running Alembic migrations…")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd="/app",
    )
    if result.returncode != 0:
        logger.error("Migration failed:\n%s", result.stderr)
        raise RuntimeError("Alembic migration failed")
    logger.info("Migrations complete.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    from services.poller import poller
    poller.start()
    logger.info("Poller started.")
    yield
    poller.stop()
    logger.info("Poller stopped.")


def create_app() -> FastAPI:
    from routers.analytics import router as analytics_router
    from routers.vehicle import router as vehicle_router
    from routers.auth import router as auth_router
    from routers.charges import router as charges_router
    from routers.dashboard import router as dashboard_router
    from routers.drives import router as drives_router
    from routers.public import router as public_router
    from routers.tesla import router as tesla_router

    app = FastAPI(
        title="Know Your Tesla (KYT) API",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    # CORS (dev only — in prod Caddy handles same-origin)
    if settings.cors_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Security headers middleware
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        return response

    app.include_router(auth_router, prefix="/api")
    app.include_router(public_router, prefix="/api")
    app.include_router(tesla_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(drives_router, prefix="/api")
    app.include_router(charges_router, prefix="/api")
    app.include_router(analytics_router, prefix="/api")
    app.include_router(vehicle_router, prefix="/api")

    @app.get("/health", tags=["system"])
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()
