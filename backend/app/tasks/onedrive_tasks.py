import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.celery_app import celery_app
from app.core.config import settings
from app.models.documents import Document
from app.models.enums import SyncStatus
from app.services.onedrive_service import onedrive_service

logger = logging.getLogger(__name__)

sync_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2")
engine = create_engine(sync_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


@celery_app.task(name="app.tasks.onedrive_tasks.sync_document_to_onedrive")
def sync_document_to_onedrive(document_id: int, local_path: str, filename: str):
    session = SessionLocal()
    try:
        doc = session.get(Document, document_id)
        if not doc:
            return {"error": "document not found"}
        url = onedrive_service.upload_to_onedrive(local_path, filename)
        if url:
            doc.onedrive_url = url
            doc.sync_status = SyncStatus.synced
        else:
            doc.sync_status = SyncStatus.failed
        session.commit()
        return {"document_id": document_id, "onedrive_url": url, "sync_status": doc.sync_status.value}
    except Exception as exc:
        logger.exception("OneDrive sync failed: %s", exc)
        doc = session.get(Document, document_id)
        if doc:
            doc.sync_status = SyncStatus.failed
            session.commit()
        return {"error": str(exc)}
    finally:
        session.close()
