import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    auth,
    cashflow,
    customers,
    dashboard,
    documents,
    export,
    health,
    invoices,
    milestones,
    reminders,
    settings as settings_routes,
    users,
)
from app.core.config import settings
from app.core.logging_config import setup_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield


app_kwargs: dict = {
    "title": settings.APP_NAME,
    "version": settings.APP_VERSION,
    "lifespan": lifespan,
}
if settings.is_production:
    app_kwargs["docs_url"] = None
    app_kwargs["redoc_url"] = None
    app_kwargs["openapi_url"] = None

app = FastAPI(**app_kwargs)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "data": None, "message": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    detail = "Internal server error" if settings.is_production else str(exc)
    return JSONResponse(
        status_code=500,
        content={"success": False, "data": None, "message": detail},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(milestones.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(cashflow.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
