# Activity index — deterministic aggregation

Reads from `../storage/`, computes a **deterministic, explainable** activity index (e.g. per-POI or per-region scores). No black-box ML; formulas and weights should be documented.

Output: structured result (e.g. JSON or table) consumed by:
- **Flare Data Connector** (attestations) — schema must match what contracts expect
- Optionally **frontend** for display

Document the output schema and update when the attestation format changes (coordinate with Person B).
