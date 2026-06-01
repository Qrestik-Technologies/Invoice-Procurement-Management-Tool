import logging
from pathlib import Path

import msal
import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]
GRAPH_BASE = "https://graph.microsoft.com/v1.0"


class OneDriveService:
    def __init__(self) -> None:
        self._app: msal.ConfidentialClientApplication | None = None

    @property
    def app(self) -> msal.ConfidentialClientApplication | None:
        if not all([settings.ONEDRIVE_CLIENT_ID, settings.ONEDRIVE_CLIENT_SECRET, settings.ONEDRIVE_TENANT_ID]):
            return None
        if self._app is None:
            self._app = msal.ConfidentialClientApplication(
                settings.ONEDRIVE_CLIENT_ID,
                authority=f"https://login.microsoftonline.com/{settings.ONEDRIVE_TENANT_ID}",
                client_credential=settings.ONEDRIVE_CLIENT_SECRET,
            )
        return self._app

    def _get_token(self) -> str | None:
        if self.app is None:
            return None
        result = self.app.acquire_token_for_client(scopes=GRAPH_SCOPE)
        if "access_token" in result:
            return result["access_token"]
        logger.warning("OneDrive token acquisition failed: %s", result.get("error_description"))
        return None

    def _upload_path(self, destination_filename: str) -> str:
        if settings.ONEDRIVE_DRIVE_ID:
            return f"/drives/{settings.ONEDRIVE_DRIVE_ID}/root:/Invoices/{destination_filename}:/content"
        logger.warning("ONEDRIVE_DRIVE_ID not set — upload will fail with client-credentials flow")
        return f"/drives/unknown/root:/Invoices/{destination_filename}:/content"

    def upload_to_onedrive(self, local_file_path: str, destination_filename: str) -> str | None:
        token = self._get_token()
        if not token:
            return None
        if not settings.ONEDRIVE_DRIVE_ID:
            logger.error("ONEDRIVE_DRIVE_ID is required for app-only Graph uploads")
            return None

        path = Path(local_file_path)
        if not path.exists():
            return None

        upload_path = self._upload_path(destination_filename)
        headers = {"Authorization": f"Bearer {token}"}
        try:
            resp = requests.put(
                f"{GRAPH_BASE}{upload_path}",
                headers=headers,
                data=path.read_bytes(),
                timeout=120,
            )
            if resp.status_code in (200, 201):
                data = resp.json()
                return data.get("webUrl") or data.get("@microsoft.graph.downloadUrl")
            logger.warning("OneDrive upload failed: %s %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.exception("OneDrive upload error: %s", exc)
        return None


onedrive_service = OneDriveService()


def schedule_onedrive_sync(document_id: int, local_path: str, filename: str) -> None:
    from app.tasks.onedrive_tasks import sync_document_to_onedrive

    sync_document_to_onedrive.delay(document_id, local_path, filename)
