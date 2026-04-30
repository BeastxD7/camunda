# Camunda Support Demo - End-to-End Setup

This repository contains:
- `backend` (Express + Camunda SDK + Prisma)
- `frontend` (React + Vite)
- `docker` (local PostgreSQL for demo persistence)

## 1. Prerequisites

Install these locally:
- Node.js 20+
- npm 10+
- Docker Desktop (or Docker Engine + Compose)

## 2. Run PostgreSQL with Docker

From the repository root:

```bash
cd docker
docker compose -f docker-compose.postgres.yml up -d --build
```

Verify DB is healthy:

```bash
docker ps
```

Connection used in this setup:

```text
postgresql://camunda:camunda@localhost:5432/camunda_demo?schema=public
```

## 3. Configure Backend Environment

Edit `backend/.env` and make sure you set:

```env
DATABASE_URL="postgresql://camunda:camunda@localhost:5432/camunda_demo?schema=public"
```

Also keep your Camunda credentials populated in the same file.

## 4. Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd ../frontend
npm install
```

## 5. Initialize Prisma Database

From `backend`:

```bash
npx prisma generate
npx prisma migrate dev --name init_demo_store
```

Optional checks:

```bash
npx prisma studio
```

## 6. Run the Project

### Start backend

```bash
cd backend
npm run dev
```

Backend default URL:
- `http://localhost:3000`
- API docs: `http://localhost:3000/docs`

### Start frontend (separate terminal)

```bash
cd frontend
npm run dev
```

Frontend URL:
- `http://localhost:5173`

## 7. Demo Data Workflow (Camunda <-> DB)

The app supports two data sources:
- `Camunda` (live)
- `DB` (Postgres snapshots)

In the top navigation:
1. Use **Sync DB** to mirror current Camunda data into PostgreSQL.
2. Switch source from **Camunda** to **DB**.
3. All major screens continue working using persisted DB snapshots.

## 8. Useful Commands

### Build checks

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

### Restart DB cleanly (data retained)

```bash
cd docker
docker compose -f docker-compose.postgres.yml restart
```

### Stop DB

```bash
cd docker
docker compose -f docker-compose.postgres.yml down
```

### Stop DB and remove volume data

```bash
cd docker
docker compose -f docker-compose.postgres.yml down -v
```

## 9. Heatmap Images

These heatmap assets are available in `frontend/public` and rendered below:

### Customer Support Automation Flow

![Customer support automation flow heatmap](frontend/public/heatmap.png)

### Card Eligibility

![Card eligibility heatmap](frontend/public/heatmap2.png)

### Unknown Transaction

![Unknown transaction heatmap](frontend/public/heatmap3.png)

## 10. Branching

Development branch for DB integration:
- `camunda-db`

Switch to it:

```bash
git checkout camunda-db
```
