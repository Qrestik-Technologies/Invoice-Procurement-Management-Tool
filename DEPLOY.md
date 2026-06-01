# Production deployment guide

## Prerequisites

- Ubuntu VPS with Docker and Docker Compose (2 GB+ RAM recommended)
- Domain DNS A record pointing to the VPS
- Strong secrets prepared locally (never commit `.env`)

## 1. Configure environment

Copy `.env.example` to `.env` and set production values:

```bash
APP_ENV=production
DEBUG=false
JWT_SECRET=<64-char-random-string>
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql+asyncpg://postgres:<strong-password>@postgresql:5432/invoice_tool
CORS_ORIGINS=["https://invoices.yourdomain.com"]
SENDGRID_API_KEY=...
COMPANY_EMAIL=invoices@yourdomain.com
ONEDRIVE_CLIENT_ID=...
ONEDRIVE_CLIENT_SECRET=...
ONEDRIVE_TENANT_ID=...
ONEDRIVE_DRIVE_ID=...
DOMAIN=invoices.yourdomain.com
```

Update `Caddyfile` with your domain or set `DOMAIN` in `.env`.

## 2. Deploy

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile tls up -d --build
```

Without TLS (temporary testing only):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# Expose nginx manually if needed — prefer the tls profile for production.
```

## 3. Create admin user

Create the first admin:

```bash
docker compose exec web env PYTHONPATH=/app python scripts/create_admin.py \
  --email admin@yourdomain.com \
  --password '<strong-password>' \
  --name 'Site Admin'
```

## 4. Post-deploy smoke test checklist

- [ ] Login with the real admin account (not demo credentials)
- [ ] Create customer → invoice → dispatch → verify PDF generated
- [ ] Upload PDF → parse → verify fields populate
- [ ] Send reminder → verify SendGrid delivery + `reminder_logs` row
- [ ] Upload document → verify OneDrive sync status
- [ ] `GET /api/health/ready` returns `ready` with PostgreSQL and Redis OK
- [ ] Confirm Adminer (`:8080`) and Postgres (`:5432`) are **not** reachable from the internet
- [ ] Confirm FastAPI `:8000` is not publicly exposed (only nginx/Caddy)

## 5. Backups

Schedule on the host (cron):

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/app && ./scripts/backup/postgres_backup.sh
30 2 * * * cd /path/to/app && ./scripts/backup/uploads_backup.sh
```

Restore PostgreSQL:

```bash
gunzip -c backups/postgres/invoice_tool_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i <postgres-container> psql -U postgres invoice_tool
```

## 6. Dev-only services

Adminer is gated behind the `dev` profile:

```bash
docker compose --profile dev up -d adminer
```
