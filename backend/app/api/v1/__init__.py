from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.customers import router as customers_router
from app.api.v1.endpoints.invoices import router as invoices_router
from app.api.v1.endpoints.milestones import router as milestones_router
from app.api.v1.endpoints.companies import router as companies_router
from app.api.v1.endpoints.settings import router as settings_router
from app.api.v1.endpoints.purchase_orders import router as purchase_orders_router
from app.api.v1.endpoints.misc import (
    payments_router,
    reminders_router,
    cashflow_router,
    audit_router,
    health_router,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(companies_router)
api_router.include_router(settings_router)
api_router.include_router(customers_router)
api_router.include_router(invoices_router)
api_router.include_router(milestones_router)
api_router.include_router(payments_router)
api_router.include_router(reminders_router)
api_router.include_router(cashflow_router)
api_router.include_router(audit_router)
api_router.include_router(health_router)
api_router.include_router(purchase_orders_router)
