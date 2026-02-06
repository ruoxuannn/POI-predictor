# Data layer — Person A (Data & Geospatial)

Owns: **ingestion**, **activity index**, **local storage**, and **cron jobs**. No Google APIs; open-source or free APIs only. All aggregation is deterministic and explainable.

---

## Folder layout

| Folder            | Purpose |
|-------------------|--------|
| `ingestion/`      | Fetch from OSM/Overpass, Mapbox (free tier), Reddit API, event APIs. Normalize and write to storage. |
| `activity-index/` | Deterministic computation of real-world “activity index” from ingested data (e.g. per-POI or per-region scores). Input: storage; output: structured result for FDC. |
| `storage/`        | Local persistence (e.g. SQLite, JSON, or parquet). Schema and retention policy live here. |
| `jobs/`           | Cron/scheduled jobs: run ingestion pipelines, then activity-index; optionally push results to FDC or expose for FDC plugin. |

---

## Data flow (this component)

1. **Ingestion** → pulls OSM, Mapbox, Reddit, events → writes into **storage**.
2. **Activity index** → reads from storage → computes deterministic index → writes result (e.g. file or table) for **FDC** and optionally for frontend.
3. **Jobs** → orchestrate (e.g. daily/hourly): run ingestion, then activity-index.

Output schema of the activity index must be agreed with **Person B** (contracts/FDC) so attestations match on-chain expectations.

---

## Setup

- Copy `data/.env.example` to `data/.env` and set API keys/URLs (Mapbox token, Reddit client id/secret, etc.).
- Install runtime (e.g. Python + venv or Node) and dependencies as needed.
- Run ingestion once, then activity-index; then schedule via `jobs/`.

---

## Dependencies

- No dependency on `contracts/` or `frontend/`; only agreed **output schema** for attestations.
- FDC (Person B) will read this layer’s output (file, HTTP, or DB) — document the path and format here.
