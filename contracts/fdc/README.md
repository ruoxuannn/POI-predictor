# Flare Data Connector (FDC) integration

Web2 plugin that:

1. Reads **activity-index output** from the data layer (file path or HTTP agreed with Person A).
2. Submits **verified attestations** into Flare via the FDC protocol.
3. Ensures attestation payload matches the **schema** expected by contracts in `../src/`.

Config, plugin code or config files, and attestation schema documentation live here. Document how to run the FDC plugin (e.g. Docker, systemd, or Flare’s recommended runner) and how often it pushes data.
