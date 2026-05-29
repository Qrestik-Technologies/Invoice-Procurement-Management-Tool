import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.tasks.reminder_tasks import check_emcor_monthly_alert, check_milestone_alerts

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        _run_milestone_check,
        CronTrigger(hour=8, minute=0),
        id="daily_milestone_alerts",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_emcor_check,
        CronTrigger(day=25, hour=8, minute=0),
        id="emcor_monthly_alert",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def _run_milestone_check():
    check_milestone_alerts.delay()


def _run_emcor_check():
    check_emcor_monthly_alert.delay()
