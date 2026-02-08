# POI Activity Index — DeFi on Flare

**Hackathon submission · Flare-native DeFi with real-world activity attestations**

A DeFi system that ingests open-source geospatial and social data, computes a deterministic activity index off-chain, attests it via **Flare Data Connector (FDC)**, and executes parametric insurance payouts and yield adjustments on-chain. Includes a map-based frontend for POIs (London pubs), activity levels, and wallet flows on **Flare Coston2** testnet.

*For judges: Our feedback on using Flare protocols is in [Flare protocols — feedback and review](#flare-protocols--feedback-and-review).*


---

## Repository structure

```
.
├── README.md
├── .gitignore
├── data/                     # Data & geospatial (London pubs)
├── contracts/                # Flare & smart contracts (Foundry)
└── frontend/                 # Next.js + wagmi (Flare Coston2)
```

See each folder’s README for details.

---

## Constraints

- **No Google APIs** — OpenStreetMap, Mapbox, Reddit, event APIs only (optional keys).
- **Deterministic, explainable** — No black-box ML; activity index and yield rules are transparent.
- **Flare-native** — FDC for attested Web2 data; Solidity on Flare Coston2; FLR/C2FLR for fees.

---

## Data flow

1. **Data** (`data/`) — Fetches OSM, floor area, employees, ratings, events → merge → activity index (revenue proxy).
2. **FDC** — Activity/index outputs can be attested via Flare Data Connector; contracts consume proofs on-chain.
3. **Contracts** (`contracts/`) — Pool, PubRegistry, SettlementEngine, FTSO oracle.
4. **Frontend** (`frontend/`) — Chain state (wagmi/viem), My Wallet, Pub Wallet, Activity & Risk, settle on-chain.

---

## Flare protocols — feedback and review

> Flare ended up being a really good fit for this project because we needed a clean way to bring real-world data on-chain without just trusting a single server or oracle. Using **Flare Data Connector (FDC)**, we could take live Web2 JSON data about POI activity and settlement parameters, get it attested, and then verify the proof directly in our smart contracts before triggering payouts.
>
> The hardest part was getting used to the full FDC flow end-to-end — preparing the request, submitting the attestation, waiting for the voting round, fetching the DA proof, and then wiring everything into our Solidity contracts. Debugging across off-chain scripts and on-chain logic took some time, especially when something went wrong in the middle of the pipeline.
>
> Once it was set up though, we had a clear mental model of where the data came from, how it was verified by the network, and how it ended up triggering real financial logic on-chain. That made Flare feel genuinely useful for building DeFi applications that depend on real-world signals like activity levels, usage, or external events, instead of just on-chain data.

---

## Local setup

- **data/** — Copy `data/.env.example` to `data/.env` if using APIs that need keys.
- **contracts/** — Copy `contracts/.env.example` to `contracts/.env`, set `PRIVATE_KEY`. Use Flare Coston2 RPC.
- **frontend/** — Copy `frontend/.env.local.example` to `frontend/.env.local` and paste the five contract addresses after deploying. Get C2FLR from the [Flare Coston2 Faucet](https://faucet.flare.network/coston2).

---

## License

MIT.
