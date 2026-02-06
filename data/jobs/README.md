# Jobs — cron / scheduled runs

Orchestrate pipelines:

1. Run **ingestion** (OSM, Mapbox, Reddit, events).
2. Run **activity-index** on latest storage data.
3. Optionally: push activity-index result to FDC or expose for the FDC plugin (coordinate with Person B).

Use cron, systemd timers, or a simple scheduler script. Document schedule and required env in this README.
