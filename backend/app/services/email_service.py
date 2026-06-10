"""Transactional email for auth flows (verification + password reset).

Mirrors the SendGrid pattern already used in app/tasks/reminder_tasks.py:
if SENDGRID_API_KEY is not set, the code is logged instead of sent so the
flow still works in local development. This function is synchronous; call it
from async routes via fastapi.concurrency.run_in_threadpool so the SendGrid
HTTP call never blocks the event loop.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _code_email_html(code: str, purpose: str) -> str:
    if purpose == "verify":
        heading = "Verify your email"
        intro = "Use the code below to verify your email address and activate your account."
    else:
        heading = "Reset your password"
        intro = "Use the code below to reset your password. If you didn't request this, you can ignore this email."

    return f"""\
<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;
            color:#111827;background:#F8F9FC;border-radius:12px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="display:inline-flex;width:48px;height:48px;border-radius:14px;background:#0C447C;
                color:#fff;font-weight:700;font-size:20px;align-items:center;justify-content:center">Q</div>
  </div>
  <h2 style="margin:0 0 8px;font-size:20px;text-align:center">{heading}</h2>
  <p style="margin:0 0 24px;font-size:14px;color:#6B7280;text-align:center">{intro}</p>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:24px;text-align:center">
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0C447C">{code}</div>
    <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF">This code expires in 10 minutes.</p>
  </div>
  <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;text-align:center">
    {settings.COMPANY_NAME} &middot; Invoice Management Tool
  </p>
</div>"""


def send_code_email(to_email: str, code: str, purpose: str) -> bool:
    """purpose is 'verify' or 'reset'. Returns True on success / dev fallback."""
    subject = "Your verification code" if purpose == "verify" else "Your password reset code"
    html = _code_email_html(code, purpose)

    if not settings.SENDGRID_API_KEY:
        # Dev fallback: surface the code in logs so the flow is testable
        # without email configured. Remove once SendGrid is live in prod.
        logger.warning("SendGrid not configured \u2014 %s code for %s is: %s", purpose, to_email, code)
        return True

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.COMPANY_EMAIL or "noreply@qrestik.com",
            to_emails=to_email,
            subject=subject,
            html_content=html,
        )
        SendGridAPIClient(settings.SENDGRID_API_KEY).send(message)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.exception("SendGrid error sending %s code to %s: %s", purpose, to_email, exc)
        return False


def send_internal_alert(subject: str, message: str) -> None:
    """Internal alert — logs to console; swap for real email if needed."""
    print(f"[INTERNAL ALERT] {subject}: {message}")
