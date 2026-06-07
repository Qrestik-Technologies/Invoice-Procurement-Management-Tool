import logging
from datetime import date, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.domain import Customer, Invoice, Milestone
from app.models.enums import InvoiceStatus, ReminderStatus, ReminderType, TemplateType
from app.models.reminder_logs import ReminderLog

logger = logging.getLogger(__name__)

sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
engine = create_engine(sync_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
email_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)), autoescape=select_autoescape(["html"]))

_SWEEP_LOCK_KEY = "reminder_sweep_running"


def _send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not settings.SENDGRID_API_KEY:
        if settings.is_production:
            logger.error("SendGrid not configured — refusing to send in production")
            return False
        logger.info("SendGrid not configured — would send to %s: %s", to_email, subject)
        return False
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.COMPANY_EMAIL or "noreply@qrestik.com",
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
        )
        SendGridAPIClient(settings.SENDGRID_API_KEY).send(message)
        return True
    except Exception as exc:
        logger.exception("SendGrid error: %s", exc)
        return False


@celery_app.task(name="app.tasks.reminder_tasks.send_reminder", bind=True)
def send_reminder(self, invoice_id: int, reminder_type: str, recipient_emails: list[str]):
    session = SessionLocal()
    try:
        invoice = session.get(Invoice, invoice_id)
        if not invoice:
            return {"error": "invoice not found"}
        customer = session.get(Customer, invoice.customer_id)
        milestone = session.get(Milestone, invoice.milestone_id) if invoice.milestone_id else None

        html = email_env.get_template("email_reminder.html").render(
            reminder_type=reminder_type,
            invoice_number=invoice.invoice_number,
            customer_name=customer.name if customer else "",
            total=float(invoice.total),
            currency=invoice.currency,
            milestone_date=milestone.end_date.isoformat() if milestone else "",
        )
        subject_line = f"Invoice {invoice.invoice_number} — {reminder_type.replace('_', ' ').title()}"

        for email in recipient_emails:
            ok = _send_email(email, subject_line, html)
            log = ReminderLog(
                invoice_id=invoice_id,
                reminder_type=ReminderType(reminder_type),
                recipient_email=email,
                status=ReminderStatus.delivered if ok else ReminderStatus.failed,
                celery_task_id=self.request.id,
            )
            session.add(log)
        session.commit()
        return {"sent_to": recipient_emails, "invoice_id": invoice_id}
    finally:
        session.close()


@celery_app.task(name="app.tasks.reminder_tasks.sweep_payment_reminders")
def sweep_payment_reminders():
    import redis

    r = redis.from_url(settings.REDIS_URL)
    if not r.set(_SWEEP_LOCK_KEY, "1", nx=True, ex=3600):
        logger.info("Payment reminder sweep already running — skipping")
        return {"skipped": True}

    session = SessionLocal()
    try:
        dispatched = session.execute(
            select(Invoice).where(Invoice.status == InvoiceStatus.dispatched)
        ).scalars().all()
        for inv in dispatched:
            customer = session.get(Customer, inv.customer_id)
            if customer:
                send_reminder.delay(inv.id, ReminderType.payment_reminder.value, [customer.email])
    finally:
        session.close()
        r.delete(_SWEEP_LOCK_KEY)


@celery_app.task(name="app.tasks.reminder_tasks.check_milestone_alerts")
def check_milestone_alerts():
    session = SessionLocal()
    try:
        today = date.today()
        end = today + timedelta(days=7)
        milestones = session.execute(
            select(Milestone).where(Milestone.end_date >= today, Milestone.end_date <= end)
        ).scalars().all()
        recipients = settings.MILESTONE_ALERT_EMAILS
        for m in milestones:
            inv = session.execute(
                select(Invoice).where(Invoice.milestone_id == m.id).limit(1)
            ).scalar_one_or_none()
            if inv:
                send_reminder.delay(inv.id, ReminderType.milestone_alert.value, recipients)
    finally:
        session.close()


@celery_app.task(name="app.tasks.reminder_tasks.check_emcor_monthly_alert")
def check_emcor_monthly_alert():
    session = SessionLocal()
    try:
        today = date.today()
        if today.day != 25:
            return
        from app.models.enums import TemplateType

        emcor_invoices = session.execute(
            select(Invoice)
            .join(Customer)
            .where(Customer.template_type == TemplateType.emcor, Invoice.status == InvoiceStatus.dispatched)
        ).scalars().all()
        for inv in emcor_invoices:
            send_reminder.delay(
                inv.id,
                ReminderType.payment_reminder.value,
                settings.MILESTONE_ALERT_EMAILS,
            )
    finally:
        session.close()
