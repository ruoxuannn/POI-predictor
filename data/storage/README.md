# Storage — local persistence

Schema and retention for ingested data and activity-index outputs. Use SQLite, JSON files, parquet, or similar; keep paths and schema documented so ingestion and activity-index can read/write consistently.

Avoid committing large DBs or dumps; use `.gitignore` as in root.
