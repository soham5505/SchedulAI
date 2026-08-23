# SchedulAI Deployment & Operations Guide

## 1. Quick Start with Docker Compose

The easiest way to run SchedulAI locally or on a virtual server is via Docker Compose.

### Prerequisites
- Docker Engine 24+ and Docker Compose v2+
- 4GB RAM minimum (8GB recommended for large solver runs)

### Steps

1. Clone the repository and configure environment variables:
   ```bash
   cp .env.example .env
   ```

2. Start all services (MongoDB, Redis, Scheduler, API, Web):
   ```bash
   docker-compose up -d --build
   ```

3. Seed initial database records:
   ```bash
   docker-compose exec api npm run seed
   ```

4. Open the Web Application:
   - **Frontend UI**: `http://localhost` (or `http://localhost:5173` in dev mode)
   - **API Gateway**: `http://localhost:5000/api/v1`
   - **Python Scheduler**: `http://localhost:8000/docs`
   - **Default Admin Login**: `admin@schedulai.local` / `AdminPassword@123`

---

## 2. Production Deployment

For production deployments, use `docker-compose.prod.yml`:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables Checklist

| Variable | Description | Production Recommendation |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listen port | `5000` |
| `MONGODB_URI` | MongoDB Connection String | Replicated cluster with TLS & auth |
| `JWT_SECRET` | Secret key for access tokens | Strong 64-char random hex string |
| `JWT_REFRESH_SECRET`| Secret key for refresh tokens | Distinct strong 64-char random string |
| `SCHEDULER_URL` | Microservice address for scheduler| `http://scheduler:8000` or private VPC endpoint |
| `OPENAI_API_KEY` | OpenAI API key for LLM queries | Optional (defaults to built-in rule parser) |
| `CORS_ORIGIN` | Allowed web origins | Specific institutional domain |

---

## 3. Kubernetes Deployment Architecture

In enterprise Kubernetes clusters:
- **API**: Deployment with 3+ replicas, Horizontal Pod Autoscaler (HPA) targeting 70% CPU.
- **Scheduler**: StatefulSet or Deployment with dedicated compute nodes (2–4 CPU cores per solver pod).
- **Frontend**: Nginx static pod or served via CDN (Cloudflare / AWS CloudFront).
- **Database**: Managed MongoDB Atlas or Percona Server for MongoDB operator.
