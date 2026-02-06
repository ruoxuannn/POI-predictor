# Deployment scripts

Run deployment and verification for Flare testnet/mainnet. Typical flow:

1. Compile contracts.
2. Deploy (e.g. Hardhat deploy script or Forge script).
3. Verify on block explorer if supported.
4. Output or save **contract addresses and ABIs** for frontend and FDC config.

Document the exact commands (e.g. `npx hardhat run scripts/deploy.js --network flare`) in this README.
