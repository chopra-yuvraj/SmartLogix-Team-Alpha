"""
SmartLogix Gateway — FastAPI Application (Tasks 3.1, 3.17)

Main entry point for the orchestration API layer.
Centralized error handling, request logging, and CORS.
"""

import logging
import time
import uuid

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from routers import shipments, routes
from schemas import ErrorResponse
from settings import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("smartlogix.gateway")

# Rate limiter for public endpoints (rules.md §7)
limiter = Limiter(key_func=get_remote_address)

# Create the FastAPI app
app = FastAPI(
    title="SmartLogix Gateway API",
    description=(
        "Dynamic Freight Consolidation & Green Routing Engine — "
        "Orchestration API for the SmartLogix platform. "
        "Smart India Hackathon 2026, SIH26198."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Middleware: Request ID + Logging (Task 3.17)
# ============================================================


@app.middleware("http")
async def add_request_id_and_log(request: Request, call_next):
    """Add correlation request ID and log each request."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id

    start_time = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000

    logger.info(
        f"{request.method} {request.url.path} "
        f"status={response.status_code} "
        f"duration={duration_ms:.1f}ms "
        f"request_id={request_id}"
    )

    response.headers["X-Request-ID"] = request_id
    return response


# ============================================================
# Centralized Error Handling (Task 3.17)
# ============================================================


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return a consistent JSON error shape for all unhandled exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.gateway_host == "0.0.0.0" else None,
            request_id=request_id,
        ).model_dump(),
    )


# ============================================================
# Include Routers
# ============================================================

app.include_router(shipments.router)
app.include_router(routes.router)


# ============================================================
# Health Check
# ============================================================


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "smartlogix-gateway",
    }


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API info."""
    return {
        "name": "SmartLogix Gateway API",
        "version": "0.1.0",
        "docs": "/docs",
    }
