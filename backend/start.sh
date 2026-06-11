#!/bin/sh
set -e

case "${PROC_ROLE:-api}" in
  worker)
    exec celery -A app.core.celery_app worker --loglevel=info -c 2
    ;;
  beat)
    exec celery -A app.core.celery_app beat --loglevel=info
    ;;
  *)
    alembic upgrade head
    exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
    ;;
esac
