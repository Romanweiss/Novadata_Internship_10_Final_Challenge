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

## Pages

- Overview
- Pipelines
- Data Quality
- Exports
- Settings

## Notes

- All data is mock and stored in `src/mocks/data.ts`.
- UI state (theme, safe mode, last runs, toasts, job runner) is managed via context reducer.
- Theme is persisted in localStorage (`pf-control-theme`).
