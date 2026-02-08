# POI Activity Index — DeFi on Flare

**ETH Oxford Hackathon · Flare-native DeFi with real-world activity attestations**

DeFi system that ingests open-source geospatial and social data, computes a deterministic activity index off-chain, attests via Flare Data Connector, and executes insurance payouts and yield adjustments on-chain. Map-based frontend for POIs, activity levels, and financial outputs.

---

## Repository tree

```
.
├── README.md                 # This file — overview, quick start, ownership
├── .env.example              # Placeholder env; each subfolder has its own
├── .gitignore
│
├── data/                     # Person A — Data & Geospatial (London pubs demo)
│   ├── README.md
│   ├── .env.example
│   ├── schemas/              # Shared schemas, pub_merged example, demo_overrides, FDC fields
│   ├── pois_osm/             # Primary POIs (OSM)
│   ├── category/             # Category expansion (TripAdvisor, BeerInTheEvening)
│   ├── ratings/              # Avg rating (BeerInTheEvening, TripAdvisor)
│   ├── price_range/          # £–£££
│   ├── floor_area/           # OSM / Mapbox
│   ├── opening_hours/        # OSM + TripAdvisor
│   ├── employees/            # Companies House
│   ├── revenue_proxy/        # Derived (employees + activity + price)
│   ├── social_mentions/      # Reddit
│   ├── events/               # Football, Wimbledon (event_multiplier)
│   ├── activity-index/       # Deterministic activity index
│   ├── storage/              # JSON, CSV, optional SQLite
│   ├── jobs/                 # Run ingestion + merge
│   └── ingestion/            # Legacy; see per-type folders for London pubs
│
├── contracts/                # Person B — Flare & Smart Contracts
│   ├── README.md
│   ├── .env.example
│   ├── src/                  # Solidity: payouts, yield, FDC consumers
│   ├── scripts/              # Deployment and verification
│   └── fdc/                  # Flare Data Connector config and integration
│
└── frontend/                 # Person C — Finance Logic & Frontend
    ├── README.md
    ├── .env.example
    ├── lib/                  # Yield & insurance math (off-chain)
    ├── src/
    │   ├── app/              # Next.js App Router pages
    │   └── components/       # Map, POI, wallet, dashboards
    └── public/               # Static assets
```

---

## Constraints

- **No Google APIs** — OpenStreetMap, Mapbox, Reddit, event APIs only
- **Deterministic, explainable** — No black-box ML; aggregation rules are transparent
- **Flare-native** — FDC (Web2 plugin) + Solidity
- **Hackathon-ready** — Clear demo path and READMEs

---

## Repo structure (team ownership)

| Folder       | Owner  | Responsibility                                      |
|-------------|--------|------------------------------------------------------|
| `data/`     | Person A | Ingestion (OSM, Reddit, events), activity index, storage, cron |
| `contracts/`| Person B | FDC integration, Solidity, payouts, yield, deployment |
| `frontend/` | Person C | Yield/insurance math, map UI, wallet, demo UX       |

---

## Data flow (high level)

1. **Data layer** (`data/`) pulls OSM, Mapbox, Reddit, event APIs → stores locally → cron runs **activity index** (deterministic aggregation).
2. **Activity index output** (e.g. per-POI scores) is sent to **Flare Data Connector** (FDC) as verified attestations.
3. **Contracts** (`contracts/`) consume FDC data on-chain and run **payout** and **yield** logic.
4. **Frontend** (`frontend/`) reads chain state + optional off-chain APIs, runs **finance math** for display/simulations, and shows **map**, dashboards, and **wallet** flows.

---

## Ownership boundaries & communication

- **Person A** owns all ingestion and index code; exposes **activity index results** (files/DB or API) for FDC and optionally for frontend.
- **Person B** owns FDC config, Solidity, and deployment; depends on **agreed schema** of attestations from the data layer.
- **Person C** owns frontend and off-chain finance logic; reads **chain state** and any **public index/API** the team agrees on; no direct dependency on data-layer internals.

Interfaces between components: **attestation schema** (data → FDC → contracts) and **contract ABIs + addresses** (contracts → frontend). Keep these documented in each folder’s README and in `contracts/` for the schema.

---

## Quick start (judge-friendly)

1. **Data:** `cd data && cat README.md` — run ingestion, then activity-index job (see `data/README.md`).
2. **Contracts:** `cd contracts && cat README.md` — deploy to Flare testnet, point FDC at data-layer output (see `contracts/README.md`).
3. **Frontend:** `cd frontend && cat README.md` — install, set env, run dev server; open map and connect wallet (see `frontend/README.md`).

Demo path: run data pipeline → deploy contracts + FDC → open frontend → connect wallet → view POIs, activity, and payouts/yield on map.

---

## Local setup

- Copy `.env.example` to `.env` in root and in each of `data/`, `contracts/`, `frontend/` as needed; fill placeholders (no secrets in repo).
- Each area can be developed in isolation; see per-folder READMEs for dependencies and commands.

---

## License

MIT (or your chosen license).
