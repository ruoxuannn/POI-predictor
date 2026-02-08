# Data pipeline — London pubs

Ingestion, merge, and **revenue_proxy** for London pubs. Output: one CSV (one row per pub) and `pubs_merged.json` in `storage/`.

## Run order

Fetches run **in parallel** (OSM, floor area, employees, ratings, events); then OSM normalize; then merge.

1. **pois_osm** — `pois_osm/fetch.js` then `pois_osm/normalize.js` → `storage/pois_osm.json`
2. **floor_area** — `floor_area/fetch.js` → `storage/floor_area.json`
3. **employees** — `employees/fetch.js` → `storage/employees.json`
4. **beerintheevening** — `beerintheevening/fetch.js` → `storage/ratings_bite.json`
5. **events** — `events/fetch.js` → `storage/events.json`
6. **Merge** — runs after any fetch. **price_range**: if `storage/price_range.json` exists (e.g. from optional `googlemaps/fetch.js`), it is merged; otherwise the merge infers £/££/£££ from revenue_proxy quartiles (no external API).

## One command (merge + CSV)

From `data/`:

```bash
node jobs/run.js          # merge existing storage → storage/pubs.csv, storage/pubs_merged.json
node jobs/run.js --fetch  # run all source scripts above, then merge
```

Merge key: **osm_id**. Revenue_proxy uses: employees, floor_area_m2, avg_rating, price_range, popularity, total_tips, event_multiplier (no sentiment yet).

## Schedule

`config/schedule.json` defines per-source intervals (e.g. OSM 1 week, ratings 1 day, events 2 weeks). Merge runs every time there is a change (after any fetch). Live fetch toggle uses `jobs/run-with-status.js` (parallel fetches, then normalize, then merge).

## Outputs

| File | Description |
|------|-------------|
| `storage/pubs.csv` | One row per pub; columns = all fields including `revenue_proxy` |
| `storage/pubs_merged.json` | Same data as JSON array |

## Setup

Copy `data/.env.example` to `data/.env` and set API keys (Companies House). OSM/Overpass needs no keys. Price range is inferred from revenue_proxy when not provided; optional `googlemaps/fetch.js` (Places API) can fill it if you have a valid key.
