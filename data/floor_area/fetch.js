#!/usr/bin/env node
/**
 * Build floor_area.json from pois_osm, then fill gaps with real or estimated area.
 *
 * 1. Use floor_area_m2 from pois_osm (OSM tags + way footprint).
 * 2. For pois still null: OSM building lookup — Overpass way(around:25m)[building]
 *    with out geom; point-in-polygon to find building containing the pub; compute
 *    real footprint area (same formula as pois_osm). Best quality.
 * 3. Optional: MAPBOX_ACCESS_TOKEN — height-based estimate for remaining nulls.
 * 4. Optional: FLOOR_AREA_DEFAULT_M2 for demo.
 *
 * Input: ../storage/pois_osm.json
 * Output: ../storage/floor_area.json (sparse: { osm_id, floor_area_m2 })
 * Env: OVERPASS_URL, OSM_FLOOR_AREA_DELAY_MS (default 300), MAPBOX_*, FLOOR_AREA_DEFAULT_M2
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const POIS_PATH = path.join(DIR, 'storage', 'pois_osm.json');
const OUT_PATH = path.join(DIR, 'storage', 'floor_area.json');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const OSM_DELAY_MS = process.env.OSM_FLOOR_AREA_DELAY_MS != null
  ? parseInt(process.env.OSM_FLOOR_AREA_DELAY_MS, 10)
  : 300;
const AROUND_M = 25;
const DEFAULT_M2 = process.env.FLOOR_AREA_DEFAULT_M2 != null
  ? parseInt(process.env.FLOOR_AREA_DEFAULT_M2, 10)
  : null;
const MAPBOX_TOKEN = (process.env.MAPBOX_ACCESS_TOKEN || '').trim() || null;
const MAPBOX_DELAY_MS = process.env.MAPBOX_DELAY_MS != null
  ? parseInt(process.env.MAPBOX_DELAY_MS, 10)
  : 150;
const M2_PER_STOREY = 80;
const HEIGHT_TO_STOREY_M = 3;

function loadEnv(file, override) {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (/^["']|["']$/.test(value)) value = value.slice(1, -1);
      if (key && (override || !process.env[key])) process.env[key] = value;
    }
  }
}
loadEnv('.env', false);
loadEnv('.env.local', true);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Area from polygon (same as pois_osm/normalize.js) ---
function latLonToMeters(lat) {
  const latPerM = 1 / 111320;
  const lonPerM = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  return { latPerM, lonPerM };
}

function geometryAreaM2(geometry) {
  if (!geometry || geometry.length < 3) return null;
  const lat0 = geometry[0].lat;
  const { latPerM, lonPerM } = latLonToMeters(lat0);
  const toX = (p) => (p.lon - geometry[0].lon) / lonPerM;
  const toY = (p) => (p.lat - geometry[0].lat) / latPerM;
  let area = 0;
  for (let i = 0; i < geometry.length; i++) {
    const j = (i + 1) % geometry.length;
    area += toX(geometry[i]) * toY(geometry[j]) - toX(geometry[j]) * toY(geometry[i]);
  }
  return Math.round(Math.abs(area) / 2);
}

/** Point-in-polygon (ray casting). */
function pointInPolygon(lat, lon, geometry) {
  const n = geometry.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = geometry[i].lon, yi = geometry[i].lat;
    const xj = geometry[j].lon, yj = geometry[j].lat;
    if (yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Overpass: buildings within AROUND_M of (lat, lon), with geometry. */
async function overpassBuildingsAt(lat, lon) {
  const query = `
[out:json][timeout:15];
way(around:${AROUND_M},${lat},${lon})["building"];
out geom;
`.trim();
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.elements || [];
}

/** For a pub at (lat, lon), find building polygon that contains it and return area (m²). Prefer smallest containing building. */
function areaFromBuildingWays(lat, lon, ways) {
  const containing = [];
  for (const way of ways) {
    const geom = way.geometry;
    if (!geom || geom.length < 3) continue;
    if (!pointInPolygon(lat, lon, geom)) continue;
    const area = geometryAreaM2(geom);
    if (area != null && area > 0) containing.push(area);
  }
  if (containing.length === 0) return null;
  return Math.min(...containing); // smallest = likely the actual building
}

/** Mapbox Tilequery: building height at point (fallback estimate). */
async function mapboxBuildingHeight(lng, lat) {
  if (!MAPBOX_TOKEN) return null;
  const url =
    'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/' +
    `${lng},${lat}.json?layers=building&geometry=polygon&limit=1&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const fc = await res.json();
  const f = fc?.features?.[0];
  if (!f || f.properties?.tilequery?.distance !== 0) return null;
  const height = f.properties?.height;
  return typeof height === 'number' && height > 0 ? height : null;
}

function estimateFloorAreaFromHeight(heightM) {
  const storeys = Math.max(1, Math.round(heightM / HEIGHT_TO_STOREY_M));
  return Math.min(2000, Math.round(storeys * M2_PER_STOREY));
}

async function main() {
  if (!fs.existsSync(POIS_PATH)) {
    console.error(`Not found: ${POIS_PATH}. Run pois_osm fetch + normalize first.`);
    process.exit(1);
  }

  const pois = JSON.parse(fs.readFileSync(POIS_PATH, 'utf8'));
  const byOsmId = new Map();

  for (const pub of pois) {
    let m2 = pub.floor_area_m2 ?? null;
    if (m2 == null && DEFAULT_M2 != null && DEFAULT_M2 > 0) m2 = DEFAULT_M2;
    if (m2 != null) byOsmId.set(pub.osm_id, m2);
  }

  const needLookup = pois.filter((p) => !byOsmId.has(p.osm_id));
  if (needLookup.length > 0) {
    // 1) OSM building footprint (real area)
    console.log(`OSM: fetching building footprint for ${needLookup.length} pois (${AROUND_M}m radius, delay ${OSM_DELAY_MS}ms)...`);
    let osmFilled = 0;
    for (let i = 0; i < needLookup.length; i++) {
      const pub = needLookup[i];
      if ((i + 1) % 50 === 0 || i === 0) process.stdout.write(`  OSM ${i + 1}/${needLookup.length}\r`);
      await sleep(OSM_DELAY_MS);
      const lat = pub.coordinates?.lat;
      const lng = pub.coordinates?.lng ?? pub.coordinates?.lon;
      if (lat == null || lng == null) continue;
      try {
        const ways = await overpassBuildingsAt(lat, lng);
        const m2 = areaFromBuildingWays(lat, lng, ways);
        if (m2 != null) {
          byOsmId.set(pub.osm_id, m2);
          osmFilled++;
        }
      } catch (_) {}
    }
    console.log('');
    if (osmFilled) console.log(`  OSM filled ${osmFilled} from building footprint.`);
  }

  const out = Array.from(byOsmId.entries()).map(([osm_id, floor_area_m2]) => ({ osm_id, floor_area_m2 }));
  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

  const withDefault = DEFAULT_M2 != null ? out.filter((r) => r.floor_area_m2 === DEFAULT_M2).length : 0;
  console.log(
    `Wrote ${out.length} floor_area records → ${path.relative(DIR, OUT_PATH)}` +
    (withDefault ? ` (${withDefault} use default ${DEFAULT_M2} m²)` : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
