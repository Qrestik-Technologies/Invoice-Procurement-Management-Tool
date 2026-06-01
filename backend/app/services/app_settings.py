import json
from pathlib import Path

from app.core.config import settings
from app.models.enums import TemplateType

SETTINGS_FILE = Path(settings.UPLOAD_DIR) / "app_settings.json"

DEFAULTS = {
    "company_name": settings.COMPANY_NAME,
    "company_email": settings.COMPANY_EMAIL,
    "business_address": "",
    "from_email": settings.COMPANY_EMAIL,
    "default_template": TemplateType.standard.value,
    "default_payment_terms": "Net 30",
}


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            stored = json.loads(SETTINGS_FILE.read_text())
            return {**DEFAULTS, **stored}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(DEFAULTS)


def save_settings(data: dict) -> dict:
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    current = load_settings()
    current.update(data)
    SETTINGS_FILE.write_text(json.dumps(current, indent=2))
    return current
