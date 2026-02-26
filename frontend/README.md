# ProbablyFresh Control Panel UI

Modern React control panel prototype for ProbablyFresh data platform.

## Stack

- React + TypeScript + Vite
- TailwindCSS
- Framer Motion
- Recharts
- Lucide React
- React Router

## Run

```bash
cd frontend
npm install
npm run dev
```

App URL: `http://localhost:5173`

## Run In Docker

From repository root:

```bash
docker compose --env-file .env up -d backend frontend
```

Frontend URL: `http://localhost:5173`  
Backend API URL: `http://localhost:8001/api`

## API Integration

Frontend reads data from backend API if available:

- `VITE_API_BASE_URL` (default `http://localhost:8001/api`)
- `VITE_API_TOKEN` (DRF token, optional but recommended)

Example `.env` for frontend:

```bash
VITE_API_BASE_URL=http://localhost:8001/api
VITE_API_TOKEN=<your_token>
```

## Pages

- Overview
- Pipelines
- Data Quality
- Exports
- Settings

## Notes

- UI uses real backend API and falls back to mocks from `src/mocks/data.ts` if backend is unavailable.
- UI state (theme, safe mode, last runs, toasts, job runner) is managed via context reducer.
- Theme is persisted in localStorage (`pf-control-theme`).
