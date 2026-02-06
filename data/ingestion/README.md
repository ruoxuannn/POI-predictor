# Ingestion — OSM, Mapbox, Reddit, Events

Fetch and normalize data from:

- **OSM / Overpass** — POIs, geometry, tags
- **Mapbox** — free-tier geocoding/search if needed
- **Reddit** — subreddits/threads (e.g. by location or topic)
- **Event APIs** — open-source or free event feeds

Output: normalized records written into `../storage/` (schema defined in storage). No Google APIs.
