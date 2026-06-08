import logging
from pathlib import Path

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_SCOPE = ["https://graph.microsoft.com/.default"]


def _get_access_token() -> str | None:
    """Acquire an app-only (client-credentials) token using the org tenant."""
    if not all([
        settings.ONEDRIVE_CLIENT_ID,
        settings.ONEDRIVE_CLIENT_SECRET,
        settings.ONEDRIVE_TENANT_ID,
    ]):
        logger.warning("OneDrive credentials not configured – skipping upload")
        return None
    try:
        import msal

        app = msal.ConfidentialClientApplication(
            settings.ONEDRIVE_CLIENT_ID,
            authority=f"https://login.microsoftonline.com/{settings.ONEDRIVE_TENANT_ID}",
            client_credential=settings.ONEDRIVE_CLIENT_SECRET,
        )
        result = app.acquire_token_silent(_SCOPE, account=None)
        if not result:
            result = app.acquire_token_for_client(scopes=_SCOPE)
        if "access_token" not in result:
            logger.error("MSAL token error: %s", result.get("error_description"))
            return None
        return result["access_token"]
    except Exception as exc:
        logger.exception("MSAL token acquisition failed: %s", exc)
        return None


def _get_org_drive_id(token: str) -> str | None:
    """Return the SharePoint/OneDrive drive ID for the organisation."""
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{_GRAPH_BASE}/sites/root/drive",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json().get("id")
            resp2 = client.get(
                f"{_GRAPH_BASE}/drives",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp2.raise_for_status()
            drives = resp2.json().get("value", [])
            if drives:
                return drives[0]["id"]
    except Exception as exc:
        logger.exception("Could not resolve org drive ID: %s", exc)
    return None


def upload_file_to_onedrive(
    file_bytes: bytes,
    filename: str,
) -> dict | None:
    """Upload file_bytes to the configured OneDrive/SharePoint folder."""
    token = _get_access_token()
    if not token:
        return None

    folder = settings.ONEDRIVE_FOLDER or "Invoices"
    drive_id = _get_org_drive_id(token)

    if drive_id:
        upload_url = (
            f"{_GRAPH_BASE}/drives/{drive_id}/root:/{folder}/{filename}:/content"
        )
    else:
        upload_url = f"{_GRAPH_BASE}/me/drive/root:/{folder}/{filename}:/content"
        logger.warning("Could not resolve org drive – falling back to /me/drive")

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
                logger.error(
                    "OneDrive 401 Unauthorized – verify Files.ReadWrite.All is "
                    "granted and admin consent is complete. Response: %s",
                    resp.text,
                )
                return None
            if resp.status_code == 403:
                logger.error(
                    "OneDrive 403 Forbidden – app may lack admin consent. Response: %s",
                    resp.text,
                )
                return None
            resp.raise_for_status()
            logger.info("OneDrive upload succeeded: %s", filename)
            return resp.json()
    except Exception as exc:
        logger.exception("OneDrive upload failed for %s: %s", filename, exc)
        return None


def get_file_download_url(item_id: str, drive_id: str | None = None) -> str | None:
    token = _get_access_token()
    if not token:
        return None
    try:
        resolved_drive = drive_id or _get_org_drive_id(token) or "me"
        with httpx.Client(timeout=30) as client:
            resp = client.get(
                f"{_GRAPH_BASE}/drives/{resolved_drive}/items/{item_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json().get("@microsoft.graph.downloadUrl")
    except Exception as exc:
        logger.exception("OneDrive get URL failed for item %s: %s", item_id, exc)
        return None


def schedule_onedrive_sync(document_id: int, local_path: str, filename: str) -> None:
    """Enqueue a Celery task to upload the document to OneDrive."""
    if not all([
        settings.ONEDRIVE_CLIENT_ID,
        settings.ONEDRIVE_CLIENT_SECRET,
        settings.ONEDRIVE_TENANT_ID,
    ]):
        logger.debug("OneDrive not configured – skipping sync for document %d", document_id)
        return
    try:
        from app.tasks.onedrive_tasks import sync_document_to_onedrive
        sync_document_to_onedrive.delay(document_id, local_path, filename)
        logger.info("Queued OneDrive sync for document %d (%s)", document_id, filename)
    except Exception as exc:
        logger.exception(
            "Failed to queue OneDrive sync for document %d: %s", document_id, exc
        )


class OneDriveService:
    def upload_to_onedrive(self, local_path: str, filename: str) -> str | None:
        file_bytes = Path(local_path).read_bytes()
        result = upload_file_to_onedrive(file_bytes, filename)
        if result:
            return result.get("webUrl") or result.get("@microsoft.graph.downloadUrl")
        return None


onedrive_service = OneDriveService()
