from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "invoice_tool",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.reminder_tasks", "app.tasks.onedrive_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "payment-reminder-sweep": {
            "task": "app.tasks.reminder_tasks.sweep_payment_reminders",
            "schedule": 86400.0,
        },
        "daily-milestone-alerts": {
            "task": "app.tasks.reminder_tasks.check_milestone_alerts",
            "schedule": crontab(hour=8, minute=0),
        },
        "emcor-monthly-alert": {
            "task": "app.tasks.reminder_tasks.check_emcor_monthly_alert",
            "schedule": crontab(day_of_month=25, hour=8, minute=0),
        },
    },
)
