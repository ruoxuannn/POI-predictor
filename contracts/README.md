# Contracts — Flare Coston2

Solidity contracts for the POI Activity Index: **Pool**, **PubRegistry**, **SettlementEngine**, **MockUSD**, **FtsoPriceOracle**. Deploy to **Flare Coston2** testnet (Chain ID 114).

## Deploy to Flare Coston2

1. Copy `.env.example` to `.env` and set `PRIVATE_KEY` (deployer wallet). Get C2FLR from [Flare Coston2 Faucet](https://faucet.flare.network/coston2).
2. Run:

```shell
forge script script/DeployAndDemo.s.sol --rpc-url https://coston2-api.flare.network/ext/C/rpc --broadcast
```

3. Copy the five logged addresses into `frontend/.env.local` (see `frontend/.env.local.example`).

## FDC (Flare Data Connector)

- `script/FdcRequestAttestation.s.sol` — request attestation for activity/settlement data.
- `script/SettleWithProof.s.sol` — settle using an FDC DA proof on-chain.
- See `fdc/README.md` for config and attestation flow.

## Foundry

- **Build:** `forge build`
- **Test:** `forge test`
- **Format:** `forge fmt`
- **Docs:** https://book.getfoundry.sh/
