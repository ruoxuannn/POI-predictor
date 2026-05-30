# POI Activity Index — Geospatial Data Pipeline & DeFi on Flare

A data pipeline that ingests open-source geospatial and social data, computes a deterministic commercial activity index across 50+ London locations, and feeds it on-chain to power parametric insurance payouts and yield adjustments on the Flare blockchain.

**[Live Demo →](https://poi-predictor.vercel.app)**

---

## What It Does

Most commercial risk assessment relies on lagging indicators — quarterly revenue reports, annual foot traffic surveys. This system computes a real-time activity index from publicly available data, creating a forward-looking revenue proxy that can trigger automated financial logic.

The pipeline has two layers:

**Off-chain: Geospatial data pipeline**
Ingests, cleans, and normalises multi-source data to produce a standardised activity score per location.

| Source | Signal | Why it matters |
|--------|--------|----------------|
| OpenStreetMap | POI density, commercial land use | Structural capacity of an area |
| Floor area data | Physical commercial footprint | Scale of commercial activity |
| Ratings data | Consumer activity and sentiment | Demand-side signal |
| Event data | Temporal activity spikes | Captures short-term surges |

**On-chain: DeFi smart contracts (Flare Coston2 testnet)**
Activity index outputs are attested via the Flare Data Connector (FDC) and consumed by Solidity contracts that execute parametric insurance payouts and yield rate adjustments — no manual claims process, no trusted intermediary.

---

## Architecture

```
Data Sources (OSM, ratings, events, floor area)
        |
        v
  Data Pipeline         <- Ingest, clean, normalise
  (Python)
        |
        v
  Activity Index        <- Deterministic, explainable score
  Computation
        |
        v
  Flare Data            <- Attest off-chain data on-chain
  Connector
        |
        v
  Smart Contracts       <- Parametric insurance + yield logic
  (Solidity)
        |
        v
  Frontend              <- Map UI, wallet flows, settlement
  (Next.js)
```

---

## Key Design Decisions

- **No black-box ML** — the activity index is deterministic and explainable, making it auditable for financial applications
- **No Google APIs** — built entirely on open-source data (OpenStreetMap, Mapbox, Reddit, event APIs)
- **Flare-native** — uses FDC for attested Web2 data rather than a centralised oracle, with FTSO price feeds for on-chain settlement

---

## Tech Stack

- **Data pipeline:** Python, Pandas, OpenStreetMap API, Mapbox
- **Smart contracts:** Solidity, Foundry, Flare Coston2 testnet
- **Frontend:** Next.js, wagmi, viem
- **On-chain infrastructure:** Flare Data Connector (FDC), FTSO oracle

---

## My Contribution

- Engineered the data ingestion and cleaning pipeline across all four sources
- Designed the normalisation and weighting logic for the composite activity index
- Built data visualisations to present index scores for downstream analysis

---

## Repo Structure
├── data/          # Data pipeline & geospatial processing
├── contracts/     # Flare smart contracts (Foundry)
└── frontend/      # Next.js + wagmi (Flare Coston2)

See each folder's README for setup details.

---

## Local Setup

- **data/** — Copy `data/.env.example` to `data/.env` if using APIs that need keys
- **contracts/** — Copy `contracts/.env.example` to `contracts/.env`, set `PRIVATE_KEY`. Use Flare Coston2 RPC
- **frontend/** — Copy `frontend/.env.local.example` to `frontend/.env.local`, paste contract addresses after deploying. Get C2FLR from the [Flare Coston2 Faucet](https://faucet.flare.network/coston2)

## License

MIT
