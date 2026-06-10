import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.tasks.reminder_tasks import check_emcor_monthly_alert, check_milestone_alerts, check_po_expiry_warnings, check_po_not_invoiced

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
    scheduler.add_job(
        _run_po_expiry_check,
        CronTrigger(hour=9, minute=0),
        id="daily_po_expiry_warnings",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_po_not_invoiced_check,
        CronTrigger(hour=9, minute=30),
        id="daily_po_not_invoiced",
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


def _run_po_expiry_check():
    check_po_expiry_warnings.delay()


def _run_po_not_invoiced_check():
    check_po_not_invoiced.delay()
