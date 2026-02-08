# Frontend — React + Next.js

- **Pipeline view:** schedule (interval, data sources) and revenue proxy.
- **Real-time:** revenue proxy refreshes from `storage/pubs_merged.json` every 8s.

## Run

```bash
cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). API routes read from `../data/storage` and `../data/config` (run from repo root or `frontend/`).

## Build

```bash
npm run build && npm run start
```
