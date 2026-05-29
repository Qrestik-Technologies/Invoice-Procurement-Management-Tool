from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    users,
)
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    async with AsyncSessionLocal() as session:
        await seed_database(session)
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
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
