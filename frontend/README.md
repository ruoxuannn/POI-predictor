# Frontend — Person C (Finance Logic & Frontend)

Owns: **yield and insurance math** (off-chain), **map-based UI**, **dashboards**, **wallet integration**, and **demo UX**. Stack: **React + Next.js** (recommended for SSR, API routes, and map integration).

---

## Folder layout

| Folder       | Purpose |
|--------------|--------|
| `lib/`       | Off-chain **yield and insurance math**: formulas, simulations, and helpers. Used by UI and optionally by API routes. |
| `src/app/`   | Next.js App Router: pages, map view, dashboards, wallet connect. |
| `src/components/` | Reusable React components: map, POI cards, payout/yield displays, wallet button. |
| `src/hooks/` | React hooks (e.g. chain state, contract reads, wallet). |
| `public/`    | Static assets. |

(If you use Pages Router instead, replace `src/app/` with `src/pages/` and adjust.)

---

## Data flow (this component)

1. Read **on-chain state** via contract ABIs and addresses (from Person B): POI state, payouts, yield params.
2. Optionally call a **public API** or static export of activity index (agreed with Person A) for richer map data.
3. **lib/** computes yield and insurance metrics for display/simulations.
4. **Map** shows POIs, activity levels, and financial outputs; **wallet** connects for transactions or view-only.

---

## Setup

- Copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_*` vars (RPC, chain id, contract addresses).
- `npm install` (or pnpm/yarn) then `npm run dev`.
- For production build: `npm run build && npm run start`.

---

## Dependencies

- **Contract ABIs and addresses** from `contracts/` (Person B); no direct dependency on data-layer code.
- Optional: HTTP or file interface to activity index (read-only) if agreed with Person A.

---

## Demo UX

Design a clear hackathon path: e.g. landing → connect wallet → map with POIs and activity → click POI → see payout/yield → optional “simulate” or “claim” flow. Keep it judge-friendly and completable in a few minutes.
