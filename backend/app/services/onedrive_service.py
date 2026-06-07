import logging
from pathlib import Path
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_SCOPE = ["https://graph.microsoft.com/.default"]


def _get_access_token() -> str | None:
    if not all([settings.ONEDRIVE_CLIENT_ID, settings.ONEDRIVE_CLIENT_SECRET, settings.ONEDRIVE_TENANT_ID]):
        logger.warning("OneDrive credentials not configured")
        return None
    try:
        import msal
        # Use "common" authority to support both personal and org accounts
        app = msal.ConfidentialClientApplication(
            settings.ONEDRIVE_CLIENT_ID,
            authority=f"https://login.microsoftonline.com/common",
            client_credential=settings.ONEDRIVE_CLIENT_SECRET,
        )
        result = app.acquire_token_silent(_SCOPE, account=None)
        if not result:
            result = app.acquire_token_for_client(scopes=_SCOPE)
        if "access_token" not in result:
            logger.error("MSAL token error: %s", result.get("error_description"))
            return None
        return result.get("access_token")
    except Exception as exc:
        logger.exception("MSAL token acquisition failed: %s", exc)
        return None


def upload_file_to_onedrive(
    file_bytes: bytes,
    filename: str,
    drive_id: str = "me",
) -> dict | None:
    token = _get_access_token()
    if not token:
        return None
    folder = settings.ONEDRIVE_FOLDER or "Invoices"
    # Use /me/drive for personal OneDrive
    upload_url = f"{_GRAPH_BASE}/me/drive/root:/{folder}/{filename}:/content"
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.put(
                upload_url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/octet-stream",
                },
                content=file_bytes,
            )
            if resp.status_code == 401:
                logger.error("OneDrive 401 - check permissions: %s", resp.text)
                return None
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.exception("OneDrive upload failed for %s: %s", filename, exc)
        return None


def get_file_download_url(item_id: str, drive_id: str = "me") -> str | None:
    token = _get_access_token()
    if not token:
        return None
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{_GRAPH_BASE}/drives/{drive_id}/items/{item_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json().get("@microsoft.graph.downloadUrl")
    except Exception as exc:
        logger.exception("OneDrive get URL failed for item %s: %s", item_id, exc)
        return None


class OneDriveService:
    def upload_to_onedrive(self, local_path: str, filename: str) -> str | None:
        file_bytes = Path(local_path).read_bytes()
        result = upload_file_to_onedrive(file_bytes, filename)
        if result:
            return result.get("webUrl") or result.get("@microsoft.graph.downloadUrl")
        return None


onedrive_service = OneDriveService()