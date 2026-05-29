# Invoice Management Tool

Full-stack invoice management application scaffold.

## Stack

**Frontend:** React 18, Vite, Tailwind CSS, React Router v6, TanStack Query, Axios, React Hook Form, Zod, TanStack Table v8, Recharts

**Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (async), Alembic, PostgreSQL, Pydantic v2, Celery, Redis, APScheduler

## Project Structure

```
├── frontend/          # React + Vite SPA
├── backend/           # FastAPI application
├── docker-compose.yml # PostgreSQL, Redis, FastAPI, Celery, Nginx
├── .env.example       # Environment variable template
└── README.md
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (local frontend dev)
- Python 3.11+ (local backend dev)

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend (via Nginx): http://localhost
- API: http://localhost:8000
- API health: http://localhost:8000/api/health

### Local Development

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server: http://localhost:5173 (proxies `/api` to backend)

## Services (Docker Compose)

| Service        | Description              |
|----------------|--------------------------|
| `web`          | FastAPI application      |
| `celery_worker`| Celery task worker       |
| `celery_beat`  | Celery periodic scheduler|
| `postgresql`   | PostgreSQL database      |
| `redis`        | Redis broker/cache       |
| `nginx`        | Frontend static + API proxy |

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

| Variable               | Description                    |
|------------------------|--------------------------------|
| `DATABASE_URL`         | Async PostgreSQL connection    |
| `REDIS_URL`            | Redis connection URL           |
| `JWT_SECRET`           | Secret key for JWT tokens      |
| `SENDGRID_API_KEY`     | SendGrid API key               |
| `COMPANY_EMAIL`        | Default sender email           |
| `ONEDRIVE_CLIENT_ID`   | Microsoft Graph client ID      |
| `ONEDRIVE_CLIENT_SECRET`| Microsoft Graph client secret |
| `ONEDRIVE_TENANT_ID`   | Microsoft Azure tenant ID      |

## License

Proprietary — Qrestik
