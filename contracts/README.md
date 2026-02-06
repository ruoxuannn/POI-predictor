# Contracts — Person B (Flare & Smart Contracts)

Owns: **Flare Data Connector (FDC)** integration, **Solidity** contracts, **on-chain payout and yield logic**, and **deployment scripts**.

---

## Folder layout

| Folder     | Purpose |
|------------|--------|
| `src/`     | Solidity contracts: consume FDC attestations, implement insurance payouts and yield adjustments. |
| `scripts/` | Deployment and verification scripts (e.g. Hardhat/Foundry). Deploy to Flare testnet/mainnet. |
| `fdc/`     | Flare Data Connector config and integration: how the Web2 plugin reads from the data layer and submits attestations on-chain. |

---

## Data flow (this component)

1. **FDC** (`fdc/`) reads activity-index output from the data layer (agreed path/schema).
2. FDC submits **verified attestations** to Flare (FDC protocol).
3. **Contracts** (`src/`) read attestations and run **payout** and **yield** logic.
4. **Scripts** deploy and verify contracts; document deployed addresses and ABIs for **Person C** (frontend).

---

## Attestation schema

Document the **exact attestation payload** (e.g. POI id, activity score, timestamp, region) here and in `fdc/` so:
- Person A (data) can align activity-index output.
- Frontend can interpret on-chain state.

Keep schema in this README or in `fdc/README.md` and update when it changes.

---

## Setup

- Copy `contracts/.env.example` to `contracts/.env` (RPC URL, private key for deployer, FDC config if needed).
- Install Hardhat or Foundry; run scripts from `scripts/`.
- Point FDC at the data layer output (file/HTTP) as agreed with Person A.

---

## Dependencies

- Depends on **data layer output schema** (agreed with Person A).
- Frontend depends on **contract ABIs and deployed addresses** from this repo; export them (e.g. build artifact or a small JSON manifest).
